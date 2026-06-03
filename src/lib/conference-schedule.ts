export type ConferenceScheduleEntry = {
  id: string;
  day: string;
  fromTime: string;
  toTime: string;
  title: string;
};

export type ConferenceScheduleDayGroup = {
  dayName: string;
  events: ConferenceScheduleEntry[];
};

export type ConferenceScheduleDisplayDay = {
  day: string;
  events: string[];
};

const REQUIRED_SCHEDULE_FIELDS = ["day", "fromTime", "toTime", "title"] as const;
type RequiredScheduleFields = (typeof REQUIRED_SCHEDULE_FIELDS)[number];

export function isConferenceScheduleEntryComplete(
  entry: Pick<ConferenceScheduleEntry, RequiredScheduleFields>
): boolean {
  return REQUIRED_SCHEDULE_FIELDS.every(
    (field) => String(entry[field] ?? "").trim().length > 0
  );
}

/** Parse raw blob/API rows into editable entries (keeps incomplete rows for the editor). */
export function parseConferenceScheduleEntries(raw: unknown): ConferenceScheduleEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    return {
      id: String(item.id || `schedule-${index}`),
      day: String(item.day || "").trim(),
      fromTime: String(item.fromTime || "").trim(),
      toTime: String(item.toTime || "").trim(),
      title: String(item.title || "").trim(),
    };
  });
}

/** Complete entries only — used for persistence and public display. */
export function normalizeConferenceScheduleEntries(raw: unknown): ConferenceScheduleEntry[] {
  return parseConferenceScheduleEntries(raw).filter(isConferenceScheduleEntryComplete);
}

export function findIncompleteConferenceScheduleEntries(
  entries: ConferenceScheduleEntry[]
): ConferenceScheduleEntry[] {
  return entries.filter((entry) => {
    const hasAny =
      entry.day.length > 0 ||
      entry.fromTime.length > 0 ||
      entry.toTime.length > 0 ||
      entry.title.length > 0;
    return hasAny && !isConferenceScheduleEntryComplete(entry);
  });
}

export function groupConferenceScheduleByDay(
  entries: ConferenceScheduleEntry[]
): ConferenceScheduleDayGroup[] {
  const dayOrder: string[] = [];
  const grouped = new Map<string, ConferenceScheduleEntry[]>();
  entries.forEach((entry) => {
    const dayName = entry.day.trim() || "Day";
    if (!grouped.has(dayName)) {
      grouped.set(dayName, []);
      dayOrder.push(dayName);
    }
    grouped.get(dayName)?.push(entry);
  });
  return dayOrder.map((dayName) => ({ dayName, events: grouped.get(dayName) || [] }));
}

export function formatConferenceScheduleLine(entry: ConferenceScheduleEntry): string {
  const toSuffix = entry.toTime ? ` (${entry.toTime})` : "";
  return `${entry.fromTime} — ${entry.title}${toSuffix}`;
}

export function conferenceScheduleToDisplayDays(
  entries: ConferenceScheduleEntry[] | undefined
): ConferenceScheduleDisplayDay[] {
  if (!entries?.length) return [];
  return groupConferenceScheduleByDay(entries).map(({ dayName, events }) => ({
    day: dayName,
    events: events.map(formatConferenceScheduleLine),
  }));
}

export type ResolveScheduleGroupsInput = {
  publicSchedule?: ConferenceScheduleEntry[];
  organizerSchedule?: ConferenceScheduleEntry[];
  fallback: ConferenceScheduleDisplayDay[];
};

/** Public API schedule first, then organizer draft, then hardcoded fallback. */
export function resolveConferenceScheduleDisplayDays(
  input: ResolveScheduleGroupsInput
): ConferenceScheduleDisplayDay[] {
  const fromPublic = conferenceScheduleToDisplayDays(input.publicSchedule);
  if (fromPublic.length > 0) return fromPublic;
  const fromOrganizer = conferenceScheduleToDisplayDays(input.organizerSchedule);
  if (fromOrganizer.length > 0) return fromOrganizer;
  return input.fallback;
}
