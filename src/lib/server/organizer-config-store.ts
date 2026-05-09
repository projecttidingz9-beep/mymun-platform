import { OrganizerConferencePreviewConfig } from "@/lib/types";
import { prisma } from "./prisma";

const JSON_PREFIX = "__preview_json__:";

function decodeStoredDescription(value: string | null | undefined): OrganizerConferencePreviewConfig | null {
  if (!value || !value.startsWith(JSON_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(JSON_PREFIX.length)) as OrganizerConferencePreviewConfig;
    return parsed;
  } catch {
    return null;
  }
}

export async function getOrganizerPreviewConfig(eventId: string) {
  const row = await prisma.organizerConferenceConfig.findUnique({
    where: { eventId },
    select: { description: true },
  });
  return decodeStoredDescription(row?.description) || null;
}

export async function setOrganizerPreviewConfig(eventId: string, patch: OrganizerConferencePreviewConfig) {
  const current = (await getOrganizerPreviewConfig(eventId)) || { eventId };
  const merged: OrganizerConferencePreviewConfig = {
    ...current,
    ...patch,
    socialLinks: {
      ...(current.socialLinks || {}),
      ...(patch.socialLinks || {}),
    },
  };
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
