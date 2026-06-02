const PREVIEW_JSON_PREFIX = "__preview_json__:";

/** Decode organizer preview JSON stored in OrganizerConferenceConfig.description. */
export function decodeOrganizerStoredBlobRecord(
  value: string | null | undefined
): Record<string, unknown> | null {
  const raw = value?.trim();
  if (!raw || !raw.startsWith(PREVIEW_JSON_PREFIX)) return null;
  try {
    return JSON.parse(raw.slice(PREVIEW_JSON_PREFIX.length)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
