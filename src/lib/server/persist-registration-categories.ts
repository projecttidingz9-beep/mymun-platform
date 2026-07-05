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

/** Replace category rows within an existing transaction. Pricing phases live on the JSON blob. */
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
    const rows = registrationCategories.map((cat) => ({
      categoryKey: cat.id,
      organizerConfigId,
      name: cat.name,
      applicationType: cat.applicationType || "delegate",
      description: cat.description ?? null,
      isOpen: cat.isOpen !== false,
      basePrice: coercePrice(cat.basePrice),
      requiresCommitteeSelection: cat.requiresCommitteeSelection !== false,
      registrationDeadline: parseDeadline(cat),
      maxDelegatesPerDelegation: cat.maxDelegatesPerDelegation ?? null,
    }));

    // Last writer wins when the client sends duplicate category keys (e.g. two "cat-delegate").
    const uniqueByKey = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      uniqueByKey.set(row.categoryKey, row);
    }

    await tx.registrationCategoryConfig.createMany({
      data: [...uniqueByKey.values()],
      skipDuplicates: true,
    });
  }

  // Pricing phases live on the registrationCategories JSON blob (source of truth). Clear any
  // legacy event-wide PricingPhaseConfig rows so they cannot drift from per-category phases.
  await tx.pricingPhaseConfig.deleteMany({
    where: { organizerConfigId },
  });
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
