import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/server/prisma";
import { resolveCommitteeForEvent } from "@/lib/server/resolve-event-committee";

export type BroadcastFilter =
  | "all"
  | "paid"
  | "allotted"
  | "committeeId"
  | "categoryId"
  | "delegationId";

export class BroadcastRecipientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BroadcastRecipientError";
  }
}

export async function findBroadcastRecipients(params: {
  eventId: string;
  filter: BroadcastFilter;
  committeeId?: string;
  categoryId?: string;
  delegationId?: string;
}) {
  const where: {
    eventId: string;
    deletedAt: null;
    paid?: boolean;
    status?: RegistrationStatus;
    committeeName?: string;
    categoryId?: string;
    delegationId?: string;
  } = {
    eventId: params.eventId,
    deletedAt: null,
  };

  switch (params.filter) {
    case "paid":
      where.paid = true;
      break;
    case "allotted":
      where.status = RegistrationStatus.ALLOTTED;
      break;
    case "committeeId": {
      const committeeId = String(params.committeeId || "").trim();
      if (!committeeId) {
        throw new BroadcastRecipientError("committeeId is required for this filter.");
      }
      const committee = await resolveCommitteeForEvent(params.eventId, committeeId);
      if (!committee) {
        throw new BroadcastRecipientError("Committee not found for this conference.");
      }
      where.committeeName = committee.name;
      where.status = RegistrationStatus.ALLOTTED;
      break;
    }
    case "categoryId": {
      const categoryId = String(params.categoryId || "").trim();
      if (!categoryId) {
        throw new BroadcastRecipientError("categoryId is required for this filter.");
      }
      where.categoryId = categoryId;
      break;
    }
    case "delegationId": {
      const delegationId = String(params.delegationId || "").trim();
      if (!delegationId) {
        throw new BroadcastRecipientError("delegationId is required for this filter.");
      }
      where.delegationId = delegationId;
      break;
    }
    case "all":
    default:
      break;
  }

  return prisma.registration.findMany({
    where,
    select: {
      id: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });
}
