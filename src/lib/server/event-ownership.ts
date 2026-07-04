/**
 * Single source of truth for "does this actor manage this event" resolution, shared by both
 * `requireEventOrganizerAccess` (single-event write gate) and `listManagedEventIds` (bulk listing
 * for "My Events"). These two previously had independently-maintained, near-duplicate logic that
 * could silently drift apart — e.g. one honoring a stale legacy blob team-email list after a real
 * database team roster was formed, and the other not. Centralizing the comparison here means any
 * future authorization change is made once and applies identically everywhere.
 */

export function normalizeOwnershipEmail(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

export type LegacyOwnershipBlob = {
  ownerUserId?: string;
  ownerEmail?: string;
  organizerTeamEmails?: string[];
};

/**
 * Matches an actor against the legacy JSON-blob-encoded owner/team fields. This fallback exists
 * only for events created before `EventTeamMember` rows were the canonical team roster, and MUST
 * NOT be consulted once a real accepted team roster exists for the event (see
 * `hasAcceptedDbTeamRoster` guards at each call site) — otherwise a removed team member or a
 * never-cleaned-up email could retain access/visibility indefinitely.
 */
export function matchesLegacyOwnerOrTeam(
  blob: LegacyOwnershipBlob | null | undefined,
  actorUserId: string | null,
  actorEmail: string | null
): boolean {
  if (!blob) return false;
  const normalizedActorEmail = normalizeOwnershipEmail(actorEmail);
  const ownerUserId = (blob.ownerUserId || "").trim();
  const ownerEmail = normalizeOwnershipEmail(blob.ownerEmail);

  if (actorUserId && ownerUserId && actorUserId === ownerUserId) return true;
  if (normalizedActorEmail && ownerEmail && normalizedActorEmail === ownerEmail) return true;

  const teamEmails = (blob.organizerTeamEmails || []).map((entry) => normalizeOwnershipEmail(entry));
  return normalizedActorEmail ? teamEmails.includes(normalizedActorEmail) : false;
}
