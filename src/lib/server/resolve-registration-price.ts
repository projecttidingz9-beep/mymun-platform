import type { OrganizerConference, RegistrationCategory } from "@/lib/types";
import { resolveRegistrationPrice } from "@/lib/pricing";
import { moneyNumber } from "@/lib/server/decimal-money";
import { getOrganizerStoredBlob } from "@/lib/server/organizer-config-store";
import { prisma } from "@/lib/server/prisma";

const dayStart = (d: Date) => new Date(d).setHours(0, 0, 0, 0);

type PhaseRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  basePrice: unknown;
  committeePriceJson: string | null;
};

function getActivePhaseRow(phases: PhaseRow[], reference: Date): PhaseRow | null {
  const current = dayStart(reference);
  const sorted = [...phases].sort((a, b) => dayStart(a.startDate) - dayStart(b.startDate));
  for (const phase of sorted) {
    const start = dayStart(phase.startDate);
    const end = dayStart(phase.endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (current >= start && current <= end) return phase;
  }
  const sortedByEnd = [...phases].sort((a, b) => dayStart(b.endDate) - dayStart(a.endDate));
  return sortedByEnd.find((phase) => dayStart(reference) > dayStart(phase.endDate)) ?? null;
}

function normalizeResolvedPrice(result: {
  amount: number;
  phaseId?: string;
  phaseName?: string;
}): { amount: number; phaseId?: string; phaseName?: string } {
  return {
    amount: Math.max(0, moneyNumber(result.amount as never)),
    phaseId: result.phaseId,
    phaseName: result.phaseName,
  };
}

function resolveFromCategory(
  category: RegistrationCategory,
  committeeConfigId: string | undefined,
  ref: Date
): { amount: number; phaseId?: string; phaseName?: string } {
  return normalizeResolvedPrice(
    resolveRegistrationPrice(category, committeeConfigId, ref)
  );
}

function legacyPhasesToCategoryPhases(
  phases: PhaseRow[]
): RegistrationCategory["pricingPhases"] {
  return phases.map((phase) => {
    let committeePrices: Array<{ committeeId: string; committeeName: string; price: number }> = [];
    if (phase.committeePriceJson) {
      try {
        const map = JSON.parse(phase.committeePriceJson) as Record<string, number>;
        committeePrices = Object.entries(map).map(([committeeId, price]) => ({
          committeeId,
          committeeName: committeeId,
          price,
        }));
      } catch {
        committeePrices = [];
      }
    }
    return {
      id: phase.id,
      name: phase.name,
      startDate: phase.startDate.toISOString(),
      endDate: phase.endDate.toISOString(),
      basePrice: moneyNumber(phase.basePrice),
      committeePrices,
    };
  });
}

export class RegistrationPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationPricingError";
  }
}

export async function resolveServerRegistrationAmount(params: {
  eventId: string;
  categoryId?: string | null;
  committeeConfigId?: string | null;
  referenceDate?: Date;
}): Promise<{ amount: number; currency: string; phaseId?: string; phaseName?: string }> {
  const ref = params.referenceDate ?? new Date();
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      currency: true,
      organizerConfig: {
        select: {
          id: true,
          registrationCategories: true,
          pricingPhases: true,
          committees: {
            select: { id: true, basePrice: true },
          },
        },
      },
    },
  });

  const currency = event?.currency?.trim() || "INR";
  const categoryId = params.categoryId?.trim();
  const committeeConfigId = params.committeeConfigId?.trim();

  // Pricing phases live on the registrationCategories JSON blob (source of truth), matching checkout UI.
  let categoryFromBlob: RegistrationCategory | undefined;
  if (categoryId) {
    const blob = (await getOrganizerStoredBlob(params.eventId)) as unknown as OrganizerConference | null;
    categoryFromBlob = blob?.registrationCategories?.find((c) => c.id === categoryId);
  }

  if (categoryFromBlob) {
    const resolved = resolveFromCategory(categoryFromBlob, committeeConfigId, ref);
    return { ...resolved, currency };
  }

  const categoryFromDb = categoryId
    ? event?.organizerConfig?.registrationCategories.find((c) => c.categoryKey === categoryId)
    : undefined;

  // Fallback: DB category + legacy event-wide PricingPhaseConfig rows (pre-blob-phase data).
  if (categoryFromDb) {
    const catPhases = event?.organizerConfig?.pricingPhases ?? [];
    const syntheticCategory: RegistrationCategory = {
      id: categoryFromDb.categoryKey,
      name: categoryFromDb.name,
      description: categoryFromDb.description ?? "",
      applicationType: categoryFromDb.applicationType as RegistrationCategory["applicationType"],
      isOpen: categoryFromDb.isOpen,
      basePrice: moneyNumber(categoryFromDb.basePrice),
      requiresCommitteeSelection: categoryFromDb.requiresCommitteeSelection,
      formFields: [],
      pricingPhases: legacyPhasesToCategoryPhases(catPhases),
    };
    const resolved = resolveFromCategory(syntheticCategory, committeeConfigId, ref);
    return { ...resolved, currency };
  }

  if (!event?.organizerConfig) {
    throw new RegistrationPricingError(
      "Conference pricing is not configured. Registration cannot be completed."
    );
  }

  const phases = event.organizerConfig.pricingPhases;
  const active = phases.length ? getActivePhaseRow(phases, ref) : null;

  if (!active) {
    const current = dayStart(ref);
    const allUpcoming =
      phases.length > 0 && phases.every((phase) => dayStart(phase.startDate) > current);
    if (allUpcoming) {
      const firstCategory = event.organizerConfig.registrationCategories[0];
      if (firstCategory) {
        return {
          amount: Math.max(0, moneyNumber(firstCategory.basePrice)),
          currency,
        };
      }
    }
    throw new RegistrationPricingError(
      "No active pricing phase is available for registration at this time."
    );
  }

  if (committeeConfigId) {
    const committee = event.organizerConfig.committees.find((c) => c.id === committeeConfigId);
    if (committee?.basePrice != null) {
      return {
        amount: Math.max(0, moneyNumber(committee.basePrice)),
        currency,
        phaseId: active.id,
        phaseName: active.name,
      };
    }
    if (active.committeePriceJson) {
      try {
        const map = JSON.parse(active.committeePriceJson) as Record<string, number>;
        const v = map[committeeConfigId];
        if (typeof v === "number" && Number.isFinite(v)) {
          return {
            amount: Math.max(0, v),
            currency,
            phaseId: active.id,
            phaseName: active.name,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    amount: Math.max(0, moneyNumber(active.basePrice)),
    currency,
    phaseId: active.id,
    phaseName: active.name,
  };
}

export async function loadRegistrationCategoryForValidation(
  eventId: string,
  categoryId: string
): Promise<{
  id: string;
  name: string;
  isOpen: boolean;
  requiresCommitteeSelection: boolean;
  registrationDeadline: Date | null;
  applicationType: string;
} | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizerConfig: {
        select: {
          registrationCategories: {
            where: { categoryKey: categoryId },
            select: {
              categoryKey: true,
              name: true,
              isOpen: true,
              requiresCommitteeSelection: true,
              registrationDeadline: true,
              applicationType: true,
            },
          },
        },
      },
    },
  });

  const fromDb = event?.organizerConfig?.registrationCategories[0];
  if (fromDb) {
    return {
      id: fromDb.categoryKey,
      name: fromDb.name,
      isOpen: fromDb.isOpen,
      requiresCommitteeSelection: fromDb.requiresCommitteeSelection,
      registrationDeadline: fromDb.registrationDeadline,
      applicationType: fromDb.applicationType,
    };
  }

  const blob = (await getOrganizerStoredBlob(eventId)) as unknown as OrganizerConference | null;
  const fromBlob = blob?.registrationCategories?.find((c) => c.id === categoryId);
  if (!fromBlob) return null;

  return {
    id: fromBlob.id,
    name: fromBlob.name,
    isOpen: fromBlob.isOpen !== false,
    requiresCommitteeSelection: fromBlob.requiresCommitteeSelection !== false,
    registrationDeadline: fromBlob.registrationDeadline
      ? new Date(fromBlob.registrationDeadline)
      : fromBlob.deadlineOverride
        ? new Date(fromBlob.deadlineOverride)
        : null,
    applicationType: fromBlob.applicationType || "delegate",
  };
}
