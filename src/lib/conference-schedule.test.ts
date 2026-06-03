import { describe, expect, it } from "vitest";
import {
  findIncompleteConferenceScheduleEntries,
  normalizeConferenceScheduleEntries,
  parseConferenceScheduleEntries,
  resolveConferenceScheduleDisplayDays,
} from "./conference-schedule";

describe("conference-schedule", () => {
  it("keeps complete entries and drops incomplete on normalize", () => {
    const parsed = parseConferenceScheduleEntries([
      { id: "a", day: "Day 1", fromTime: "09:00", toTime: "10:00", title: "Opening" },
      { id: "b", day: "Day 1", fromTime: "11:00", toTime: "", title: "Partial" },
    ]);
    expect(parsed).toHaveLength(2);
    expect(normalizeConferenceScheduleEntries(parsed)).toHaveLength(1);
    expect(normalizeConferenceScheduleEntries(parsed)[0]?.title).toBe("Opening");
  });

  it("finds incomplete rows that have some fields filled", () => {
    const incomplete = findIncompleteConferenceScheduleEntries(
      parseConferenceScheduleEntries([
        { day: "Day 1", fromTime: "09:00", title: "No end time" },
      ])
    );
    expect(incomplete).toHaveLength(1);
  });

  it("prefers public schedule over organizer and fallback", () => {
    const groups = resolveConferenceScheduleDisplayDays({
      publicSchedule: [
        { id: "1", day: "Day 1", fromTime: "09:00", toTime: "10:00", title: "Public" },
      ],
      organizerSchedule: [
        { id: "2", day: "Day 1", fromTime: "08:00", toTime: "09:00", title: "Local" },
      ],
      fallback: [{ day: "Day 1", events: ["Default"] }],
    });
    expect(groups[0]?.events[0]).toContain("Public");
  });
});
