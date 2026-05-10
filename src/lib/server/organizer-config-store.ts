import { OrganizerConferencePreviewConfig } from "@/lib/types";
import { prisma } from "./prisma";

const JSON_PREFIX = "__preview_json__:";

function decodeStoredDescriptionRecord(value: string | null | undefined): Record<string, unknown> | null {
  if (!value || !value.startsWith(JSON_PREFIX)) return null;
  try {
    return JSON.parse(value.slice(JSON_PREFIX.length)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mergeDeep(target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    if (
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = mergeDeep(out[key] as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export async function getOrganizerStoredBlob(eventId: string): Promise<Record<string, unknown>> {
  const row = await prisma.organizerConferenceConfig.findUnique({
    where: { eventId },
    select: { description: true },
  });
  return decodeStoredDescriptionRecord(row?.description) ?? {};
}

export async function mergeOrganizerStoredBlob(eventId: string, patch: Record<string, unknown>) {
  const current = await getOrganizerStoredBlob(eventId);
  const merged = mergeDeep(current, patch);
  const social = merged.socialLinks;
  if (social && typeof social === "object" && !Array.isArray(social)) {
    merged.socialLinks = {
      ...(current.socialLinks as Record<string, unknown> | undefined),
      ...(patch.socialLinks as Record<string, unknown> | undefined),
    };
  }
  await prisma.organizerConferenceConfig.upsert({
    where: { eventId },
    update: {
      description: `${JSON_PREFIX}${JSON.stringify(merged)}`,
    },
    create: {
      eventId,
      description: `${JSON_PREFIX}${JSON.stringify(merged)}`,
    },
  });
  return merged;
}

export async function getOrganizerPreviewConfig(eventId: string): Promise<OrganizerConferencePreviewConfig | null> {
  const row = await prisma.organizerConferenceConfig.findUnique({
    where: { eventId },
    select: { description: true },
  });
  const raw = decodeStoredDescriptionRecord(row?.description);
  return raw ? (raw as unknown as OrganizerConferencePreviewConfig) : null;
}

export async function setOrganizerPreviewConfig(eventId: string, patch: OrganizerConferencePreviewConfig) {
  const currentRaw = await getOrganizerStoredBlob(eventId);
  const mergedRecord = mergeDeep(currentRaw, patch as unknown as Record<string, unknown>);
  const prevSocial = currentRaw.socialLinks;
  mergedRecord.socialLinks = {
    ...(typeof prevSocial === "object" && prevSocial !== null && !Array.isArray(prevSocial)
      ? (prevSocial as Record<string, unknown>)
      : {}),
    ...(patch.socialLinks as Record<string, unknown> | undefined),
  };
  await prisma.organizerConferenceConfig.upsert({
    where: { eventId },
    update: {
      description: `${JSON_PREFIX}${JSON.stringify(mergedRecord)}`,
    },
    create: {
      eventId,
      description: `${JSON_PREFIX}${JSON.stringify(mergedRecord)}`,
    },
  });
  return mergedRecord as unknown as OrganizerConferencePreviewConfig;
}
