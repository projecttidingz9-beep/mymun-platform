import { prisma } from "./prisma";

export type PartnershipStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export type PartnershipRecord = {
  id: string;
  sourceEventId: string;
  targetEventId: string;
  status: PartnershipStatus;
  createdByUserId: string;
  respondedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type EventLite = { id: string; title: string };

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeRow(row: {
  id: string;
  sourceEventId: string;
  targetEventId: string;
  status: string;
  createdByUserId: string;
  respondedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PartnershipRecord {
  return {
    id: row.id,
    sourceEventId: row.sourceEventId,
    targetEventId: row.targetEventId,
    status: row.status as PartnershipStatus,
    createdByUserId: row.createdByUserId,
    respondedByUserId: row.respondedByUserId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function ensureEventExists(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    throw new Error("Event not found.");
  }
}

export async function listEventPartnerships(eventId: string) {
  await ensureEventExists(eventId);
  const rows = await prisma.eventPartnership.findMany({
    where: {
      OR: [{ sourceEventId: eventId }, { targetEventId: eventId }],
    },
    orderBy: { updatedAt: "desc" },
  });

  const partnerIds = Array.from(
    new Set(
      rows.map((row) => (row.sourceEventId === eventId ? row.targetEventId : row.sourceEventId))
    )
  );
  const events =
    partnerIds.length === 0
      ? []
      : await prisma.event.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, title: true },
        });
  const eventById = new Map(events.map((event) => [event.id, event]));

  return rows.map((row) => {
    const normalized = normalizeRow(row);
    const partnerEventId =
      normalized.sourceEventId === eventId ? normalized.targetEventId : normalized.sourceEventId;
    const direction = normalized.sourceEventId === eventId ? "outgoing" : "incoming";
    return {
      ...normalized,
      direction,
      partnerEvent: eventById.get(partnerEventId) || { id: partnerEventId, title: partnerEventId },
    };
  });
}

export async function invitePartnerEvent(input: {
  sourceEventId: string;
  targetEventId: string;
  actorUserId: string;
}) {
  const { sourceEventId, targetEventId, actorUserId } = input;
  if (sourceEventId === targetEventId) {
    throw new Error("Cannot invite the same event as partner.");
  }
  await ensureEventExists(sourceEventId);
  await ensureEventExists(targetEventId);

  const source = [sourceEventId, targetEventId].sort()[0]!;
  const target = [sourceEventId, targetEventId].sort()[1]!;

  const existing = await prisma.eventPartnership.findUnique({
    where: {
      sourceEventId_targetEventId: { sourceEventId: source, targetEventId: target },
    },
  });

  if (existing) {
    const row = normalizeRow(existing);
    if (row.status === "PENDING" || row.status === "ACCEPTED") {
      throw new Error("Partnership already exists for this event pair.");
    }
  }

  const id = `partnership-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const saved = await prisma.eventPartnership.upsert({
    where: {
      sourceEventId_targetEventId: { sourceEventId: source, targetEventId: target },
    },
    create: {
      id,
      sourceEventId: source,
      targetEventId: target,
      status: "PENDING",
      createdByUserId: actorUserId,
    },
    update: {
      status: "PENDING",
      createdByUserId: actorUserId,
      respondedByUserId: null,
    },
  });

  return normalizeRow(saved);
}

export async function updatePartnershipStatus(input: {
  eventId: string;
  partnershipId: string;
  actorUserId: string;
  nextStatus: "ACCEPTED" | "REJECTED" | "CANCELLED";
}) {
  const row = await getPartnershipById(input.partnershipId);
  if (!row) throw new Error("Partnership not found.");
  if (row.status !== "PENDING" && input.nextStatus !== "CANCELLED") {
    throw new Error("Only pending partnerships can be accepted or rejected.");
  }
  const isSourceContext = row.sourceEventId === input.eventId;
  const isTargetContext = row.targetEventId === input.eventId;
  if (!isSourceContext && !isTargetContext) {
    throw new Error("Partnership does not belong to this event.");
  }
  if (input.nextStatus === "CANCELLED" && row.createdByUserId !== input.actorUserId) {
    throw new Error("Only the invitation creator can cancel.");
  }
  if (input.nextStatus !== "CANCELLED" && !isTargetContext) {
    throw new Error("Only the target event can accept or reject this invitation.");
  }

  const updated = await prisma.eventPartnership.update({
    where: { id: input.partnershipId },
    data: {
      status: input.nextStatus,
      respondedByUserId: input.actorUserId,
    },
  });

  return normalizeRow(updated);
}

export async function unlinkPartnership(input: {
  eventId: string;
  partnershipId: string;
  actorUserId: string;
}) {
  const row = await getPartnershipById(input.partnershipId);
  if (!row) throw new Error("Partnership not found.");
  if (row.status !== "ACCEPTED") {
    throw new Error("Only accepted partnerships can be unlinked.");
  }
  const actorInEvent = row.sourceEventId === input.eventId || row.targetEventId === input.eventId;
  if (!actorInEvent) {
    throw new Error("Partnership does not belong to this event.");
  }
  await prisma.eventPartnership.update({
    where: { id: row.id },
    data: {
      status: "CANCELLED",
      respondedByUserId: input.actorUserId,
    },
  });
}

export async function getAcceptedPartnerEventIds(eventId: string): Promise<string[]> {
  const rows = await prisma.eventPartnership.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ sourceEventId: eventId }, { targetEventId: eventId }],
    },
    select: { sourceEventId: true, targetEventId: true },
  });
  return rows.map((row) =>
    row.sourceEventId === eventId ? row.targetEventId : row.sourceEventId
  );
}

export async function getEventTitlesByIds(eventIds: string[]): Promise<EventLite[]> {
  if (eventIds.length === 0) return [];
  return prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, title: true },
  });
}

async function getPartnershipById(partnershipId: string): Promise<PartnershipRecord | null> {
  const row = await prisma.eventPartnership.findUnique({
    where: { id: partnershipId },
  });
  if (!row) return null;
  return normalizeRow(row);
}
