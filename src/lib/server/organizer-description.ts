const PREVIEW_JSON_PREFIX = "__preview_json__:";

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function decodeOrganizerDescription(value: string | null | undefined): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  if (!raw.startsWith(PREVIEW_JSON_PREFIX)) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw.slice(PREVIEW_JSON_PREFIX.length)) as Record<string, unknown>;
    const nestedDescription = normalizeText(
      typeof parsed.description === "string" ? parsed.description : null
    );
    return nestedDescription;
  } catch {
    return null;
  }
}
