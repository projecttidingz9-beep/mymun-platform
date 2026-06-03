import { prisma } from "@/lib/server/prisma";
import type { RequestActor } from "@/lib/server/auth";

export async function requireRegistrationOwner(actor: RequestActor, registrationId: string) {
  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true },
  });
  if (!user) return null;

  return prisma.registration.findFirst({
    where: { id: registrationId, userId: user.id, deletedAt: null },
    select: {
      id: true,
      userId: true,
      eventId: true,
      committeeName: true,
      status: true,
      paid: true,
    },
  });
}
