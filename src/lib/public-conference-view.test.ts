import { describe, expect, it } from "vitest";
import { resolvePublishedConferenceDisplay } from "./public-conference-view";
import type { Conference, OrganizerConference, PublicConferenceDetail } from "./types";

const catalog: Conference = {
  id: "evt-1",
  title: "Public Title",
  slug: "public-title",
  location: "Singapore",
  city: "Singapore",
  country: "Singapore",
  region: "Asia",
  startDate: "July 1, 2026",
  endDate: "July 3, 2026",
  registrationDeadline: "June 1, 2026",
  price: 500,
  currency: "INR",
  level: "University",
  committees: [
    {
      id: "cm-1",
      name: "UNSC",
      abbreviation: "UNSC",
      topic1: "Security",
      topic2: "",
      difficulty: "Intermediate",
      size: 30,
    },
  ],
  capacity: 100,
  registered: 10,
  description: "Public description from API",
  organizer: "Public Org",
  organizerEmail: "org@example.com",
  website: "https://example.com",
  featured: false,
  color: "from-slate-700 to-slate-900",
  tags: ["Asia", "Elite"],
};

const organizerConference = {
  id: "evt-1",
  title: "Local Only Title",
  city: "Mumbai",
  country: "India",
  organizerName: "Local Org",
  status: "Published",
  capacity: 100,
  level: "University",
  startDate: "2026-07-01",
  endDate: "2026-07-03",
  description: "Stale local description",
  registrationCategories: [],
  committees: [],
  applicants: [],
  announcements: [],
  tags: ["Local"],
  awards: [{ id: "a1", category: "Best Delegate", prizeTitle: "Trophy" }],
} as OrganizerConference;

describe("resolvePublishedConferenceDisplay", () => {
  it("prefers marketplace catalog over organizer local state when published", () => {
    const publicDetail: PublicConferenceDetail = {
      ...catalog,
      whatIsIncluded: ["Kit"],
      conferenceSchedule: [
        { id: "s1", day: "Day 1", fromTime: "09:00", toTime: "10:00", title: "Opening" },
      ],
      awards: [{ id: "a2", category: "Best Chair", prizeTitle: "Medal" }],
      previousEditions: [
        { id: "e1", year: "2025", title: "Last Year", delegates: 120 },
      ],
    };

    const view = resolvePublishedConferenceDisplay({
      catalog,
      publicDetail,
      organizerConference,
    });

    expect(view?.useServerPublicContent).toBe(true);
    expect(view?.displayTitle).toBe("Public Title");
    expect(view?.safeDisplayDescription).toContain("Public description");
    expect(view?.displayTags).toEqual(["Asia", "Elite"]);
    expect(view?.overviewAwardLines[0]).toContain("Best Chair");
    expect(view?.previousEditions[0]?.title).toBe("Last Year");
  });

  it("uses organizer draft view when not published on server", () => {
    const draft = { ...organizerConference, status: "Draft" as const };
    const view = resolvePublishedConferenceDisplay({
      catalog: null,
      publicDetail: null,
      organizerConference: draft,
    });

    expect(view?.useServerPublicContent).toBe(false);
    expect(view?.displayTitle).toBe("Local Only Title");
    expect(view?.safeDisplayDescription).toContain("Stale local");
  });
});
