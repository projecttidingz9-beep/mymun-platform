import { describe, it, expect } from "vitest";
import type { PricingPhaseConfig } from "@/generated/prisma/client";
import { mapPublishedEventToConference, mapPublishedEventToPublicDetail } from "./marketplace-public";
import type { EventWithListing } from "./marketplace-public";

const PREVIEW_JSON_PREFIX = "__preview_json__:";

function makeEvent(overrides?: Partial<EventWithListing>): EventWithListing {
  const start = new Date("2026-07-01");
  const end = new Date("2026-07-03");
  return {
    id: "evt-1",
    title: "Relational Title",
    slug: "relational-title",
    status: "PUBLISHED",
    currency: "INR",
    startDate: start,
    endDate: end,
    coverImageUrl: null,
    deletedAt: null,
    ownerUserId: "owner-1",
    owner: { name: "Owner Name", email: "owner@example.com" },
    _count: { registrations: 2 },
    organizerConfig: {
      id: "cfg-1",
      eventId: "evt-1",
      venue: "Old Venue, Mumbai, India",
      description: `${PREVIEW_JSON_PREFIX}${JSON.stringify({
        title: "Blob Title",
        city: "Singapore",
        country: "Singapore",
        organizerName: "Blob Organizer",
        description: "Blob body text",
        whatIsIncluded: ["Meals", "Materials"],
        conferenceSchedule: [
          { id: "s1", day: "Day 1", fromTime: "09:00", toTime: "10:00", title: "Opening" },
        ],
        termsAndConditions: "Terms here",
        level: "University",
        tags: ["Elite", "Asia"],
      })}`,
      logoImageUrl: null,
      bannerImageUrl: null,
      websiteUrl: null,
      instagramUrl: null,
      linkedinUrl: null,
      twitterUrl: null,
      brandPrimaryColor: null,
      brandSecondaryColor: null,
      committees: [],
      pricingPhases: [],
    },
    ...overrides,
  } as EventWithListing;
}

describe("mapPublishedEventToConference", () => {
  it("merges blob city, country, title, and tags for delegates", () => {
    const conference = mapPublishedEventToConference(makeEvent());
    expect(conference.title).toBe("Blob Title");
    expect(conference.city).toBe("Singapore");
    expect(conference.country).toBe("Singapore");
    expect(conference.organizer).toBe("Blob Organizer");
    expect(conference.level).toBe("University");
    expect(conference.tags).toEqual(["Elite", "Asia"]);
    expect(conference.description).toBe("Blob body text");
  });

  it("handles pricing phase dates serialized as ISO strings", () => {
    const base = makeEvent();
    const stringPhases = [
      {
        id: "phase-1",
        organizerConfigId: "cfg-1",
        name: "Early Bird",
        startDate: "2026-05-01T00:00:00.000Z",
        endDate: "2026-06-01T00:00:00.000Z",
        basePrice: 1500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as unknown as PricingPhaseConfig[];
    const conference = mapPublishedEventToConference(
      makeEvent({
        organizerConfig: {
          ...base.organizerConfig!,
          pricingPhases: stringPhases,
        },
      })
    );
    expect(conference.registrationOpenDate).toContain("May");
    expect(conference.registrationDeadline).toContain("June");
  });
});

describe("mapPublishedEventToPublicDetail", () => {
  it("exposes schedule, policies, and whats included from blob", () => {
    const detail = mapPublishedEventToPublicDetail(makeEvent());
    expect(detail.whatIsIncluded).toEqual(["Meals", "Materials"]);
    expect(detail.conferenceSchedule).toHaveLength(1);
    expect(detail.termsAndConditions).toBe("Terms here");
  });

  it("includes approved reviews and common documents when provided", () => {
    const event = makeEvent();
    const blob = JSON.parse(
      String(event.organizerConfig?.description).slice("__preview_json__:".length)
    ) as Record<string, unknown>;
    blob.commonDocuments = [
      {
        id: "d1",
        title: "Rules",
        category: "rules",
        sourceType: "url",
        url: "https://example.com/rules.pdf",
      },
    ];
    event.organizerConfig!.description = `__preview_json__:${JSON.stringify(blob)}`;

    const detail = mapPublishedEventToPublicDetail(event, {
      approvedReviews: [
        {
          id: "r1",
          userName: "Alex",
          rating: 5,
          comment: "Great",
        },
      ],
    });
    expect(detail.commonDocuments?.[0]?.title).toBe("Rules");
    expect(detail.reviews?.[0]?.userName).toBe("Alex");
  });

  it("exposes awards and previous editions from blob", () => {
    const event = makeEvent();
    const blob = JSON.parse(
      String(event.organizerConfig?.description).slice("__preview_json__:".length)
    ) as Record<string, unknown>;
    blob.awards = [{ id: "a1", category: "Best Delegate", prizeTitle: "Gold Medal" }];
    blob.previousEditions = [
      { id: "pe1", year: "2024", title: "First Edition", delegates: 80, highlights: "Strong debates" },
    ];
    event.organizerConfig!.description = `__preview_json__:${JSON.stringify(blob)}`;

    const detail = mapPublishedEventToPublicDetail(event);
    expect(detail.awards?.[0]?.prizeTitle).toBe("Gold Medal");
    expect(detail.previousEditions?.[0]?.title).toBe("First Edition");
  });
});
