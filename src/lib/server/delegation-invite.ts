import { prisma } from "@/lib/server/prisma";
import { toIsoString } from "@/lib/server/coerce-date";

export type DelegationInvitePayload = {
  delegation: {
    id: string;
    schoolName: string;
    name: string | null;
    status: string;
    maxMembers: number | null;
    memberCount: number;
    ownerName: string;
  };
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    status: string;
  };
};

export async function getDelegationInviteByToken(
  token: string
): Promise<{ info: DelegationInvitePayload | null; error: string | null }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { info: null, error: "Invite token is required." };
  }

  const delegation = await prisma.delegation.findUnique({
    where: { inviteToken: trimmed },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      },
      owner: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });

  if (!delegation) {
    return { info: null, error: "Delegation invite not found." };
  }

  return {
    info: {
      delegation: {
        id: delegation.id,
        schoolName: delegation.schoolName ?? "",
        name: delegation.name,
        status: delegation.status,
        maxMembers: delegation.maxMembers,
        memberCount: delegation._count.members + 1,
        ownerName: delegation.owner.name,
      },
      event: {
        id: delegation.event.id,
        title: delegation.event.title,
        startDate: toIsoString(delegation.event.startDate),
        endDate: toIsoString(delegation.event.endDate),
        status: delegation.event.status,
      },
    },
    error: null,
  };
}
