import { prisma } from "@/lib/server/prisma";

export async function resolveCommitteeForEvent(eventId: string, committeeId: string) {
  return prisma.committeeConfig.findFirst({
    where: {
      id: committeeId,
      organizerConfig: { eventId },
    },
    select: { id: true, name: true },
  });
}

export async function resolveCommitteeIdFromRegistration(registration: {
  eventId: string;
  committeeName: string | null;
}) {
  if (!registration.committeeName?.trim()) return null;

  const committee = await prisma.committeeConfig.findFirst({
    where: {
      organizerConfig: { eventId: registration.eventId },
      name: { equals: registration.committeeName.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  return committee?.id ?? null;
}
