import { OrganizerConference, User } from "@/lib/types";

export type OrganizerIdentity = {
  id?: string | null;
  email?: string | null;
};

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function conferenceTeamEmails(conference: OrganizerConference): string[] {
  return (conference.organizerTeam || [])
    .map((member) => normalizeEmail(member.email))
    .filter(Boolean);
}

export function hasOrganizerConferenceAccess(
  identity: OrganizerIdentity | null | undefined,
  conference: OrganizerConference
): boolean {
  if (!identity) return false;
  const actorId = (identity.id || "").trim();
  const actorEmail = normalizeEmail(identity.email);

  const ownerUserId = (conference.ownerUserId || "").trim();
  const ownerEmail = normalizeEmail(conference.ownerEmail);
  if (actorId && ownerUserId && actorId === ownerUserId) return true;
  if (actorEmail && ownerEmail && actorEmail === ownerEmail) return true;

  const memberByUserId = (conference.organizerTeam || []).some((member) => {
    const memberId = (member.userId || "").trim();
    return Boolean(actorId && memberId && actorId === memberId);
  });
  if (memberByUserId) return true;

  if (!actorEmail) return false;
  return conferenceTeamEmails(conference).includes(actorEmail);
}

export function isOrganizerUser(user: User | null): boolean {
  return user?.role === "organizer" || user?.role === "admin";
}

