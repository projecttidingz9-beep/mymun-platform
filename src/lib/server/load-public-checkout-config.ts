import type { OrganizerCommittee, PricingPhase, RegistrationCategory } from "@/lib/types";
import { moneyNumber } from "@/lib/server/decimal-money";
import { prisma } from "@/lib/server/prisma";
import { getOrganizerStoredBlob } from "@/lib/server/organizer-config-store";

function committeePricesFromJson(
  json: string | null,
  committees: Array<{ id: string; name: string; basePrice?: number | null }>
) {
  if (!json) {
    return committees.map((cm) => ({
      committeeId: cm.id,
      committeeName: cm.name,
      price: cm.basePrice == null ? 0 : moneyNumber(cm.basePrice),
    }));
  }
  try {
    const map = JSON.parse(json) as Record<string, number>;
    return committees.map((cm) => ({
      committeeId: cm.id,
      committeeName: cm.name,
      price: typeof map[cm.id] === "number" ? map[cm.id] : cm.basePrice == null ? 0 : moneyNumber(cm.basePrice),
    }));
  } catch {
    return committees.map((cm) => ({
      committeeId: cm.id,
      committeeName: cm.name,
      price: cm.basePrice == null ? 0 : moneyNumber(cm.basePrice),
    }));
  }
}

function pricingPhasesFromDb(
  phases: Array<{
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    basePrice: unknown;
    committeePriceJson: string | null;
  }>,
  committees: Array<{ id: string; name: string; basePrice?: number | null }>
): PricingPhase[] {
  return phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    startDate: phase.startDate.toISOString().slice(0, 10),
    endDate: phase.endDate.toISOString().slice(0, 10),
    basePrice: moneyNumber(phase.basePrice),
    committeePrices: committeePricesFromJson(phase.committeePriceJson, committees),
  }));
}

function categoriesFromDb(
  rows: Array<{
    id: string;
    name: string;
    description: string | null;
    applicationType: string;
    isOpen: boolean;
    basePrice: unknown;
    requiresCommitteeSelection: boolean;
    registrationDeadline: Date | null;
    maxDelegatesPerDelegation: number | null;
  }>,
  pricingPhases: PricingPhase[]
): RegistrationCategory[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    applicationType: row.applicationType as RegistrationCategory["applicationType"],
    isOpen: row.isOpen,
    basePrice: moneyNumber(row.basePrice),
    requiresCommitteeSelection: row.requiresCommitteeSelection,
    registrationDeadline: row.registrationDeadline?.toISOString(),
    maxDelegatesPerDelegation: row.maxDelegatesPerDelegation ?? undefined,
    formFields: [],
    pricingPhases,
  }));
}

export type PublicCheckoutConfig = {
  eventId: string;
  currency: string;
  registrationCategories: RegistrationCategory[];
  committees: OrganizerCommittee[];
  logoImageUrl?: string;
  allocationMode?: "PAY_FIRST" | "ALLOT_FIRST";
};

/** Public registration config for delegate checkout (published events only). */
export async function loadPublicCheckoutConfig(eventKey: string): Promise<PublicCheckoutConfig | null> {
  const event = await prisma.event.findFirst({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      OR: [{ id: eventKey }, { slug: eventKey }],
    },
    select: {
      id: true,
      currency: true,
      organizerConfig: {
        select: {
          registrationCategories: true,
          pricingPhases: true,
          logoImageUrl: true,
          allocationMode: true,
          committees: {
            select: {
              id: true,
              name: true,
              agenda: true,
              type: true,
              committeeFormat: true,
              seatCount: true,
              basePrice: true,
              visibility: true,
            },
          },
        },
      },
    },
  });

  if (!event) return null;

  const blob = await getOrganizerStoredBlob(event.id);
  const blobCategories = Array.isArray(blob.registrationCategories)
    ? (blob.registrationCategories as RegistrationCategory[])
    : undefined;
  const blobCommittees = Array.isArray(blob.committees)
    ? (blob.committees as OrganizerCommittee[])
    : [];

  const dbCommittees = (event.organizerConfig?.committees ?? []).map((committee) => ({
    id: committee.id,
    name: committee.name,
    agenda: committee.agenda?.trim() || "Agenda to be announced",
    seatCount: committee.seatCount,
    basePrice: committee.basePrice == null ? undefined : moneyNumber(committee.basePrice),
    committeeFormat: committee.committeeFormat ?? undefined,
    isPublic: committee.visibility === "PUBLIC",
    portfolios: [] as OrganizerCommittee["portfolios"],
    customQuestions: [] as OrganizerCommittee["customQuestions"],
  }));

  const committeesById = new Map<string, OrganizerCommittee>();
  for (const committee of dbCommittees) {
    committeesById.set(committee.id, committee);
  }
  for (const committee of blobCommittees) {
    const existing = committeesById.get(committee.id);
    const merged = existing ? { ...existing, ...committee, id: committee.id } : committee;
    if (committee.customQuestions?.length) {
      merged.customQuestions = committee.customQuestions;
    }
    committeesById.set(committee.id, merged);
  }
  const committees = Array.from(committeesById.values()).filter((committee) => committee.isPublic !== false);

  const pricingPhases = pricingPhasesFromDb(event.organizerConfig?.pricingPhases ?? [], dbCommittees);

  let registrationCategories: RegistrationCategory[];
  const dbCategories =
    (event.organizerConfig?.registrationCategories.length ?? 0) > 0
      ? categoriesFromDb(event.organizerConfig!.registrationCategories, pricingPhases)
      : [];

  if (blobCategories && blobCategories.length > 0) {
    // Blob is source of truth for per-category phases + form fields. Fall back to
    // legacy event-wide PricingPhaseConfig rows when a blob category has none yet.
    registrationCategories = blobCategories.map((category) => ({
      ...category,
      formFields: Array.isArray(category.formFields) ? category.formFields : [],
      pricingPhases:
        Array.isArray(category.pricingPhases) && category.pricingPhases.length > 0
          ? category.pricingPhases
          : pricingPhases,
    }));
    for (const dbCategory of dbCategories) {
      const hasType = registrationCategories.some(
        (entry) => (entry.applicationType || "delegate") === (dbCategory.applicationType || "delegate")
      );
      if (!hasType && dbCategory.isOpen !== false) {
        const blobMatch = blobCategories.find(
          (entry) => entry.id === dbCategory.id || entry.applicationType === dbCategory.applicationType
        );
        registrationCategories.push({
          ...dbCategory,
          formFields: blobMatch?.formFields?.length ? blobMatch.formFields : dbCategory.formFields,
          pricingPhases:
            blobMatch?.pricingPhases?.length ? blobMatch.pricingPhases : dbCategory.pricingPhases,
        });
      }
    }
  } else if (dbCategories.length > 0) {
    registrationCategories = dbCategories.map((category) => {
      const blobMatch = blobCategories?.find(
        (entry) => entry.id === category.id || entry.applicationType === category.applicationType
      );
      return {
        ...category,
        formFields: blobMatch?.formFields?.length ? blobMatch.formFields : category.formFields,
        pricingPhases:
          blobMatch?.pricingPhases?.length ? blobMatch.pricingPhases : category.pricingPhases,
      };
    });
  } else {
    registrationCategories = [
      {
        id: "cat-default",
        name: "Delegate Registration",
        description: "Default registration category.",
        applicationType: "delegate",
        isOpen: true,
        basePrice: pricingPhases[0]?.basePrice ?? 0,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases,
      },
    ];
  }

  const logoFromBlob =
    typeof blob.logoImageUrl === "string" && blob.logoImageUrl.trim()
      ? blob.logoImageUrl.trim()
      : undefined;

  return {
    eventId: event.id,
    currency: event.currency?.trim() || "INR",
    registrationCategories: registrationCategories.filter((category) => category.isOpen !== false),
    committees,
    logoImageUrl: logoFromBlob || event.organizerConfig?.logoImageUrl || undefined,
    allocationMode:
      event.organizerConfig?.allocationMode === "PAY_FIRST" ||
      event.organizerConfig?.allocationMode === "ALLOT_FIRST"
        ? event.organizerConfig.allocationMode
        : undefined,
  };
}
