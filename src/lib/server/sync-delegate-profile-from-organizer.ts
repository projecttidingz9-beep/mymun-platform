import type { Prisma } from "@/generated/prisma/client";
import type { DelegateMunAward, DelegateMunParticipation } from "@/lib/types";

const EVENT_MARKER_PREFIX = "event:";

export function participationEventMarker(eventId: string): string {
  return `${EVENT_MARKER_PREFIX}${eventId}`;
}

function readProfileRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? ({ ...value } as Record<string, unknown>) : {};
}

function readParticipations(profile: Record<string, unknown>): DelegateMunParticipation[] {
  return Array.isArray(profile.munParticipations)
    ? (profile.munParticipations as DelegateMunParticipation[])
    : [];
}

function readAwards(profile: Record<string, unknown>): DelegateMunAward[] {
  return Array.isArray(profile.munAwards) ? (profile.munAwards as DelegateMunAward[]) : [];
}

export function roleLabelForApplicationType(
  applicationType: string,
  chairRole?: string | null
): string {
  if (applicationType === "organizer") return "Organising Committee";
  if (applicationType === "secretariat") return "Secretariat";
  if (applicationType === "chair") return chairRole?.trim() || "Executive Board";
  if (applicationType === "delegation") return "Delegation Head";
  if (applicationType === "press") return "Press Corps";
  return "Delegate";
}

export function upsertParticipationInProfile(
  delegateProfile: unknown,
  entry: DelegateMunParticipation,
  eventId: string
): Prisma.InputJsonValue {
  const profile = readProfileRecord(delegateProfile);
  const marker = participationEventMarker(eventId);
  const participations = readParticipations(profile);
  const existingIndex = participations.findIndex(
    (item) => item.notes === marker || item.id === `part-sync-${eventId}`
  );
  const nextEntry: DelegateMunParticipation = {
    ...entry,
    id: existingIndex >= 0 ? participations[existingIndex]!.id : `part-sync-${eventId}`,
    notes: marker,
  };
  const nextParticipations =
    existingIndex >= 0
      ? participations.map((item, index) => (index === existingIndex ? nextEntry : item))
      : [...participations, nextEntry];
  return {
    ...profile,
    munParticipations: nextParticipations,
  } as unknown as Prisma.InputJsonValue;
}

export function appendAwardToProfile(
  delegateProfile: unknown,
  award: DelegateMunAward
): { profile: Prisma.InputJsonValue; summary: string } {
  const profile = readProfileRecord(delegateProfile);
  const awards = readAwards(profile);
  const nextAwards = [...awards, award];
  const existingSummary =
    typeof profile.munAwardsSummary === "string" ? profile.munAwardsSummary.trim() : "";
  const summaryLine = `${award.title} - ${award.conferenceName}`;
  const nextSummary = existingSummary ? `${existingSummary}\n${summaryLine}` : summaryLine;
  return {
    profile: {
      ...profile,
      munAwards: nextAwards,
      munAwardsSummary: nextSummary,
    } as unknown as Prisma.InputJsonValue,
    summary: nextSummary,
  };
}
