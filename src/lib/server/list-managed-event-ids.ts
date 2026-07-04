import { prisma } from "./prisma";
import { matchesLegacyOwnerOrTeam, type LegacyOwnershipBlob } from "./event-ownership";

const JSON_PREFIX = "__preview_json__:";

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

  // Events that already have a real (accepted) team roster in the database must be governed
  // exclusively by that roster — a stale legacy blob (e.g. an organizer who was later removed
  // from the team, or an email that was never cleaned up) must never grant continued visibility.
  // This mirrors the same guard enforced by `requireEventOrganizerAccess` for write access, so
  // "can I see it in My Events" and "can I actually edit it" never diverge.
  const eventIdsWithConfig = configs.map((row) => row.eventId);
  const teamCounts = eventIdsWithConfig.length
    ? await prisma.eventTeamMember.groupBy({
        by: ["eventId"],
        where: { eventId: { in: eventIdsWithConfig }, acceptedAt: { not: null } },
        _count: { eventId: true },
      })
    : [];
  const eventsWithDbTeam = new Set(teamCounts.map((row) => row.eventId));

  for (const row of configs) {
    if (eventsWithDbTeam.has(row.eventId) && !ids.has(row.eventId)) {
      // Already-resolved via the DB-backed owner/team queries above, or not a match at all —
      // either way, the legacy blob must not be consulted once a real roster exists.
      continue;
    }

    const blob = parseBlob(row.description) as LegacyOwnershipBlob;
    if (matchesLegacyOwnerOrTeam(blob, actorUserId, actorEmail)) {
      ids.add(row.eventId);
    }
  }

  return [...ids];
}
