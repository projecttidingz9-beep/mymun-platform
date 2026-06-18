import { test, expect } from "@playwright/test";
import {
  SEED_EVENT_ID,
  SEED_EVENT_SLUG,
  SEED_ORGANIZER_EMAIL,
  SEED_PASSWORD,
  isSeedCatalogLoaded,
  loginWithCredentials,
} from "./helpers/seed";

test.describe("organiser updates propagate to delegates", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ request }) => {
    const loaded = await isSeedCatalogLoaded(request);
    test.skip(!loaded, "Run npm run db:seed against DATABASE_URL before E2E.");
  });

  test("public detail exposes seed schedule, documents, and approved reviews", async ({ request }) => {
    const res = await request.get(`/api/marketplace/${SEED_EVENT_ID}`);
    expect(res.ok()).toBeTruthy();
    const { conference } = (await res.json()) as {
      conference: {
        conferenceSchedule?: Array<{ title: string }>;
        commonDocuments?: Array<{ title: string }>;
        reviews?: Array<{ comment: string }>;
        termsAndConditions?: string;
      };
    };
    expect(conference.conferenceSchedule?.some((e) => e.title.includes("Opening"))).toBe(true);
    expect(conference.commonDocuments?.some((d) => d.title.includes("Handbook"))).toBe(true);
    expect(conference.reviews?.some((r) => r.comment.includes("seed review"))).toBe(true);
    expect(conference.termsAndConditions).toContain("Seed terms");
  });

  test("organiser schedule patch appears on marketplace detail", async ({ request }) => {
    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const scheduleTitle = `E2E Schedule ${Date.now()}`;
    const patch = await request.patch(`/api/organizers/conference-config/${SEED_EVENT_ID}`, {
      data: {
        conferenceSchedule: [
          {
            id: `e2e-schedule-${Date.now()}`,
            day: "Day 1",
            fromTime: "09:00",
            toTime: "10:00",
            title: scheduleTitle,
          },
        ],
      },
    });
    expect(patch.ok()).toBeTruthy();

    const detail = await request.get(`/api/marketplace/${SEED_EVENT_ID}`);
    expect(detail.ok()).toBeTruthy();
    const detailBody = (await detail.json()) as {
      conference: { conferenceSchedule?: Array<{ title: string }> };
    };
    expect(detailBody.conference.conferenceSchedule?.some((e) => e.title === scheduleTitle)).toBe(true);
  });

  test("organiser preview blob fields appear on marketplace detail", async ({ request }) => {
    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const marker = `E2E Overview ${Date.now()}`;
    const patch = await request.patch(`/api/organizers/conference-config/${SEED_EVENT_ID}`, {
      data: {
        description: marker,
        tags: ["E2E", "SyncTest"],
        whatIsIncluded: ["Delegate kit", "Socials"],
        awards: [{ id: "e2e-award", category: "Best Delegate", prizeTitle: "Crystal Gavel" }],
        previousEditions: [
          { id: "e2e-ed", year: "2024", title: "Prior Edition", delegates: 99, highlights: "Legacy" },
        ],
      },
    });
    expect(patch.ok()).toBeTruthy();

    const detail = await request.get(`/api/marketplace/${SEED_EVENT_ID}`);
    expect(detail.ok()).toBeTruthy();
    const body = (await detail.json()) as {
      conference: {
        description: string;
        tags: string[];
        whatIsIncluded?: string[];
        awards?: Array<{ prizeTitle?: string }>;
        previousEditions?: Array<{ title: string }>;
      };
    };
    expect(body.conference.description).toContain(marker);
    expect(body.conference.tags).toEqual(expect.arrayContaining(["E2E", "SyncTest"]));
    expect(body.conference.whatIsIncluded).toContain("Delegate kit");
    expect(body.conference.awards?.some((a) => a.prizeTitle === "Crystal Gavel")).toBe(true);
    expect(body.conference.previousEditions?.some((e) => e.title === "Prior Edition")).toBe(true);
  });

  test("organiser title patch appears on marketplace detail and catalog", async ({ request }) => {
    const updatedTitle = `Global Summit E2E ${Date.now()}`;

    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const patch = await request.patch(`/api/organizers/conference-config/${SEED_EVENT_ID}`, {
      data: { title: updatedTitle },
    });
    expect(patch.ok()).toBeTruthy();

    const detail = await request.get(`/api/marketplace/${SEED_EVENT_ID}`);
    expect(detail.ok()).toBeTruthy();
    const detailBody = (await detail.json()) as { conference: { title: string } };
    expect(detailBody.conference.title).toBe(updatedTitle);

    const list = await request.get("/api/marketplace");
    const listBody = (await list.json()) as { conferences: Array<{ id: string; title: string }> };
    expect(listBody.conferences.some((c) => c.id === SEED_EVENT_ID && c.title === updatedTitle)).toBe(true);
  });

  test("published conference stays on marketplace after organiser full sync", async ({ request }) => {
    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const myEvents = await request.get("/api/organizers/my-events");
    expect(myEvents.ok()).toBeTruthy();
    const { conferences } = (await myEvents.json()) as {
      conferences: Array<{ id: string; title: string; status: string }>;
    };
    const seed = conferences.find((c) => c.id === SEED_EVENT_ID);
    expect(seed).toBeTruthy();
    if (!seed) return;

    const syncTitle = `${seed.title} Sync ${Date.now()}`;
    const sync = await request.put(`/api/organizers/conferences/${SEED_EVENT_ID}/sync`, {
      data: {
        conference: { ...seed, title: syncTitle, status: "Published" },
        syncStatus: true,
      },
    });
    expect(sync.ok()).toBeTruthy();

    const list = await request.get("/api/marketplace");
    const listBody = (await list.json()) as { conferences: Array<{ id: string; title: string }> };
    expect(listBody.conferences.some((c) => c.id === SEED_EVENT_ID)).toBe(true);

    const detail = await request.get(`/api/marketplace/${SEED_EVENT_ID}`);
    const detailBody = (await detail.json()) as { conference: { title: string } };
    expect(detailBody.conference.title).toBe(syncTitle);
  });
});
