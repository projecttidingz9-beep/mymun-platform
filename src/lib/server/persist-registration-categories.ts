import type { RegistrationCategory } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";
import {
  findIncompletePricingPhases,
  formatIncompletePricingPhasesMessage,
} from "@/lib/pricing";
import { mergeOrganizerStoredBlob } from "@/lib/server/organizer-config-store";
import { runPrismaTransaction } from "@/lib/server/prisma";

export const REGISTRATION_CATEGORIES_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

function coercePrice(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function parseDeadline(cat: RegistrationCategory): Date | null {
  if (cat.registrationDeadline) {
    const d = new Date(cat.registrationDeadline);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (cat.deadlineOverride) {
    const d = new Date(cat.deadlineOverride);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parsePhaseDate(value: string, phaseName: string, fieldLabel: string): Date {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(
      `Pricing phase "${phaseName}" is missing a ${fieldLabel}. Complete every pricing phase or remove empty phases before saving.`
    );
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Pricing phase "${phaseName}" has an invalid ${fieldLabel}. Complete every pricing phase or remove empty phases before saving.`
    );
  }
  return parsed;
}

/** Replace category + pricing phase rows within an existing transaction. */
export async function syncRegistrationCategoriesToDb(
  tx: Prisma.TransactionClient,
  organizerConfigId: string,
  registrationCategories: RegistrationCategory[]
): Promise<void> {
  const incompletePhases = findIncompletePricingPhases(registrationCategories);
  if (incompletePhases.length > 0) {
    throw new Error(formatIncompletePricingPhasesMessage(incompletePhases));
  }

  await tx.registrationCategoryConfig.deleteMany({
    where: { organizerConfigId },
  });

  if (registrationCategories.length > 0) {
    await tx.registrationCategoryConfig.createMany({
      data: registrationCategories.map((cat) => ({
        id: cat.id,
        organizerConfigId,
        name: cat.name,
        applicationType: cat.applicationType || "delegate",
        description: cat.description ?? null,
        isOpen: cat.isOpen !== false,
        basePrice: coercePrice(cat.basePrice),
        requiresCommitteeSelection: cat.requiresCommitteeSelection !== false,
        registrationDeadline: parseDeadline(cat),
        maxDelegatesPerDelegation: cat.maxDelegatesPerDelegation ?? null,
      })),
    });
  }

  const phaseMap = new Map<string, RegistrationCategory["pricingPhases"][number]>();
  for (const cat of registrationCategories) {
    for (const phase of cat.pricingPhases || []) {
      if (!phaseMap.has(phase.id)) phaseMap.set(phase.id, phase);
    }
  }

  await tx.pricingPhaseConfig.deleteMany({
    where: { organizerConfigId },
  });

  if (phaseMap.size > 0) {
    await tx.pricingPhaseConfig.createMany({
      data: [...phaseMap.values()].map((phase) => {
        const committeePriceObj = Object.fromEntries(
          (phase.committeePrices || []).map((cp) => [cp.committeeId, cp.price])
        );
        return {
          organizerConfigId,
          name: phase.name,
          startDate: parsePhaseDate(phase.startDate, phase.name, "start date"),
          endDate: parsePhaseDate(phase.endDate, phase.name, "end date"),
          basePrice: coercePrice(phase.basePrice),
          committeePriceJson: JSON.stringify(committeePriceObj),
        };
      }),
    });
  }
}

/** Persist registration categories to preview blob and relational config (no committee wipe). */
export async function persistRegistrationCategories(
  eventId: string,
  registrationCategories: RegistrationCategory[]
): Promise<void> {
  await mergeOrganizerStoredBlob(eventId, { registrationCategories });

  await runPrismaTransaction(async (tx) => {
    const configRow = await tx.organizerConferenceConfig.findUnique({
      where: { eventId },
      select: { id: true },
    });
    if (!configRow) {
      throw new Error("OrganizerConferenceConfig missing for event.");
    }
    await syncRegistrationCategoriesToDb(tx, configRow.id, registrationCategories);
  }, REGISTRATION_CATEGORIES_TX_OPTIONS);
}
