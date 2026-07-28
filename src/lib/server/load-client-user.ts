import type { User } from "@/lib/types";
import { reconcileDelegationLifecycleForEvent } from "@/lib/server/delegation-lifecycle";
import { expireOverdueAllotmentPayments } from "@/lib/server/expire-allotment-deadlines";
import { prismaUserToClientUser } from "@/lib/server/map-db-user";
import { prisma } from "@/lib/server/prisma";

const clientUserInclude = {
  registrations: {
    where: { deletedAt: null },
    include: {
      event: { select: { title: true } },
      delegation: { select: { id: true, schoolName: true, inviteToken: true } },
    },
  },
} as const;

/** Load a user row and map to the client `User` shape (same as GET /api/user/me). */
export async function loadClientUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: clientUserInclude,
  });
  if (!user) return null;

  // Allot-first: cancel seats that were not paid by the payment deadline.
  await expireOverdueAllotmentPayments({ userId: user.id });
  const eventIds = [...new Set(user.registrations.map((registration) => registration.eventId))];
  await Promise.all(eventIds.map((eventId) => reconcileDelegationLifecycleForEvent(eventId)));

  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    include: clientUserInclude,
  });
  if (!refreshed) return null;
  return prismaUserToClientUser(refreshed);
}
