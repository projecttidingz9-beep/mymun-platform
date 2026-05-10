import { prisma } from "./prisma";

const JSON_PREFIX = "__preview_json__:";

function normalizeEmail(value: string | undefined | null) {
  return (value || "").trim().toLowerCase();
}

function parseBlob(description: string | null | undefined): Record<string, unknown> {
  if (!description || !description.startsWith(JSON_PREFIX)) return {};
  try {
    return JSON.parse(description.slice(JSON_PREFIX.length)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Returns event ids the actor may manage: owner, accepted team member, or legacy preview/team email match.
 */
export async function listManagedEventIds(
  actorUserId: string | null,
  actorEmail: string | null
): Promise<string[]> {
  const ids = new Set<string>();
  const normalizedEmail = normalizeEmail(actorEmail);

  if (actorUserId) {
    const owned = await prisma.event.findMany({
      where: { ownerUserId: actorUserId, deletedAt: null },
      select: { id: true },
    });
    owned.forEach((e) => ids.add(e.id));

    const team = await prisma.eventTeamMember.findMany({
      where: {
        userId: actorUserId,
        acceptedAt: { not: null },
        event: { deletedAt: null },
      },
      select: { eventId: true },
    });
    team.forEach((t) => ids.add(t.eventId));
  }

  const configs = await prisma.organizerConferenceConfig.findMany({
    where: { event: { deletedAt: null } },
    select: { eventId: true, description: true },
  });

  for (const row of configs) {
    const blob = parseBlob(row.description);
    const ownerUid = typeof blob.ownerUserId === "string" ? blob.ownerUserId.trim() : "";
    const ownerMail = normalizeEmail(typeof blob.ownerEmail === "string" ? blob.ownerEmail : "");
    const teamEmailsRaw = Array.isArray(blob.organizerTeamEmails) ? blob.organizerTeamEmails : [];
    const teamEmails = teamEmailsRaw
      .map((e) => normalizeEmail(String(e)))
      .filter(Boolean);

    if (actorUserId && ownerUid && ownerUid === actorUserId) {
      ids.add(row.eventId);
    }
    if (normalizedEmail) {
      if (ownerMail && ownerMail === normalizedEmail) ids.add(row.eventId);
      if (teamEmails.includes(normalizedEmail)) ids.add(row.eventId);
    }
  }

  return [...ids];
}
