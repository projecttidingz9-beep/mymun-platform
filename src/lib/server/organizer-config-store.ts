import { OrganizerConferencePreviewConfig } from "@/lib/types";

const previewConfigStore = new Map<string, OrganizerConferencePreviewConfig>();

export function getOrganizerPreviewConfig(eventId: string) {
  return previewConfigStore.get(eventId) || null;
}

export function setOrganizerPreviewConfig(eventId: string, patch: OrganizerConferencePreviewConfig) {
  const current = previewConfigStore.get(eventId) || { eventId };
  const merged: OrganizerConferencePreviewConfig = {
    ...current,
    ...patch,
    socialLinks: {
      ...(current.socialLinks || {}),
      ...(patch.socialLinks || {}),
    },
  };
  previewConfigStore.set(eventId, merged);
  return merged;
}
