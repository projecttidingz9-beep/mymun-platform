import { DelegationStatus } from "@/generated/prisma/enums";
import { getOrganizerStoredBlob } from "@/lib/server/organizer-config-store";
import { prisma } from "@/lib/server/prisma";

type DelegationCategoryRule = {
  id: string;
  name: string;
  applicationType: string;
  isOpen: boolean;
  registrationDeadline: Date | null;
  minDelegatesPerDelegation: number | null;
};

type DelegateCategoryTarget = {
  id: string;
  name: string;
};

function resolveCategoryRulesFromBlob(
  blobCategories: unknown
): Array<{
  id?: string;
  name?: string;
  applicationType?: string;
  isOpen?: boolean;
  registrationDeadline?: string;
  deadlineOverride?: string;
  minDelegatesPerDelegation?: number;
}> {
  if (!Array.isArray(blobCategories)) return [];
  return blobCategories.filter((entry) => !!entry && typeof entry === "object") as Array<{
    id?: string;
    name?: string;
    applicationType?: string;
    isOpen?: boolean;
    registrationDeadline?: string;
    deadlineOverride?: string;
    minDelegatesPerDelegation?: number;
  }>;
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveCloseAt(eventEndDate: Date, category: DelegationCategoryRule): Date {
  return category.registrationDeadline ?? eventEndDate;
}

export async function reconcileDelegationLifecycleForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      endDate: true,
      organizerConfig: {
        select: {
          registrationCategories: {
            where: { applicationType: { in: ["delegation", "delegate"] } },
            select: {
              id: true,
              name: true,
              applicationType: true,
              isOpen: true,
              registrationDeadline: true,
            },
          },
        },
      },
    },
  });
  if (!event) return { checked: 0, dissolved: 0 };

  const delegateCategory = event.organizerConfig?.registrationCategories.find(
    (entry) => entry.applicationType === "delegate"
  ) as DelegateCategoryTarget | undefined;

  const blobJson = await getOrganizerStoredBlob(event.id);
  const blobRules = resolveCategoryRulesFromBlob(blobJson.registrationCategories);

  const dbCategory =
    event.organizerConfig?.registrationCategories.find(
      (entry) => entry.applicationType === "delegation"
    ) ?? null;
  if (!dbCategory) return { checked: 0, dissolved: 0 };

  const blobCategory =
    blobRules.find((entry) => entry.id === dbCategory.id) ||
    blobRules.find((entry) => (entry.applicationType || "delegate") === "delegation") ||
    null;
  const minDelegates =
    typeof blobCategory?.minDelegatesPerDelegation === "number" &&
    Number.isFinite(blobCategory.minDelegatesPerDelegation) &&
    blobCategory.minDelegatesPerDelegation > 0
      ? Math.floor(blobCategory.minDelegatesPerDelegation)
      : null;
  const closeAt = resolveCloseAt(event.endDate, {
    ...dbCategory,
    registrationDeadline:
      parseIsoDate(blobCategory?.registrationDeadline) ??
      parseIsoDate(blobCategory?.deadlineOverride) ??
      dbCategory.registrationDeadline,
    minDelegatesPerDelegation: minDelegates,
  });

  if (new Date() < closeAt) return { checked: 0, dissolved: 0 };

  const openDelegations = await prisma.delegation.findMany({
    where: { eventId: event.id, status: DelegationStatus.OPEN },
    select: {
      id: true,
      ownerUserId: true,
      _count: { select: { members: true } },
    },
  });
  if (openDelegations.length === 0) return { checked: 0, dissolved: 0 };

  // Close all open delegations once registration for delegation is closed.
  // If configured min size is not met, unlink members so their registrations remain valid as individual applications.
  let dissolvedCount = 0;
  for (const delegation of openDelegations) {
    const memberCount = delegation._count.members + 1;
    const shouldDissolve = minDelegates !== null && memberCount < minDelegates;
    await prisma.$transaction(async (tx) => {
      await tx.delegation.update({
        where: { id: delegation.id },
        data: { status: DelegationStatus.CLOSED },
      });
      if (shouldDissolve) {
        await tx.registration.updateMany({
          where: {
            eventId: event.id,
            delegationId: delegation.id,
            deletedAt: null,
          },
          data: {
            delegationId: null,
            isDelegationHead: false,
            ...(delegateCategory
              ? { categoryId: delegateCategory.id, categoryName: delegateCategory.name }
              : {}),
          },
        });
      }
    });
    if (shouldDissolve) dissolvedCount += 1;
  }

  return { checked: openDelegations.length, dissolved: dissolvedCount };
}

