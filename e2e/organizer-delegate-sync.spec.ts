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

  test("organiser title patch appears on marketplace and conference page", async ({ request, page }) => {
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

    await page.goto(`/conference/${SEED_EVENT_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(updatedTitle, {
      timeout: 15_000,
    });
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
