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

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeRow(row: Record<string, unknown>): PartnershipRecord {
  return {
    id: String(row.id),
    sourceEventId: String(row.sourceEventId),
    targetEventId: String(row.targetEventId),
    status: String(row.status) as PartnershipStatus,
    createdByUserId: String(row.createdByUserId),
    respondedByUserId: row.respondedByUserId ? String(row.respondedByUserId) : null,
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
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "EventPartnership"
     WHERE "sourceEventId" = ? OR "targetEventId" = ?
     ORDER BY "updatedAt" DESC`,
    eventId,
    eventId
  );

  const partnerIds = Array.from(
    new Set(
      rows.map((row) =>
        String(row.sourceEventId) === eventId ? String(row.targetEventId) : String(row.sourceEventId)
      )
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

  const source = [sourceEventId, targetEventId].sort()[0];
  const target = [sourceEventId, targetEventId].sort()[1];
  const existing = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "EventPartnership"
     WHERE "sourceEventId" = ? AND "targetEventId" = ?
     LIMIT 1`,
    source,
    target
  );
  if (existing.length > 0) {
    const row = normalizeRow(existing[0]);
    if (row.status === "PENDING" || row.status === "ACCEPTED") {
      throw new Error("Partnership already exists for this event pair.");
    }
  }

  const id = `partnership-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EventPartnership"
      ("id","sourceEventId","targetEventId","status","createdByUserId","createdAt","updatedAt")
     VALUES (?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT("sourceEventId","targetEventId")
     DO UPDATE SET
       "status"='PENDING',
       "createdByUserId"=excluded."createdByUserId",
       "respondedByUserId"=NULL,
       "updatedAt"=CURRENT_TIMESTAMP`,
    id,
    source,
    target,
    actorUserId
  );

  const saved = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "EventPartnership"
     WHERE "sourceEventId" = ? AND "targetEventId" = ?
     LIMIT 1`,
    source,
    target
  );
  return normalizeRow(saved[0]);
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

  await prisma.$executeRawUnsafe(
    `UPDATE "EventPartnership"
     SET "status" = ?, "respondedByUserId" = ?, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = ?`,
    input.nextStatus,
    input.actorUserId,
    input.partnershipId
  );
  const updated = await getPartnershipById(input.partnershipId);
  if (!updated) throw new Error("Partnership not found after update.");
  return updated;
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
  await prisma.$executeRawUnsafe(
    `UPDATE "EventPartnership"
     SET "status" = 'CANCELLED', "respondedByUserId" = ?, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = ?`,
    input.actorUserId,
    row.id
  );
}

export async function getAcceptedPartnerEventIds(eventId: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT "sourceEventId","targetEventId" FROM "EventPartnership"
     WHERE ("sourceEventId" = ? OR "targetEventId" = ?)
       AND "status" = 'ACCEPTED'`,
    eventId,
    eventId
  );
  return rows.map((row) =>
    String(row.sourceEventId) === eventId ? String(row.targetEventId) : String(row.sourceEventId)
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
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "EventPartnership" WHERE "id" = ? LIMIT 1`,
    partnershipId
  );
  if (rows.length === 0) return null;
  return normalizeRow(rows[0]);
}
