import { test, expect } from "@playwright/test";
import {
  SEED_EVENT_ID,
  SEED_ORGANIZER_EMAIL,
  SEED_PASSWORD,
  SEED_REGISTRATION_ALLOTTED,
  isSeedCatalogLoaded,
  loginWithCredentials,
} from "./helpers/seed";

test.describe("Indian MUN feature pack (seeded conference)", () => {
  test.beforeEach(async ({ request }) => {
    const loaded = await isSeedCatalogLoaded(request);
    test.skip(!loaded, "Run npm run db:seed against DATABASE_URL before E2E.");
  });
  test("delegation invite page loads for seed token", async ({ page }) => {
    await page.goto("/join/delegation/seed-delegation-invite-token");
    await expect(page.getByRole("heading", { name: /join delegation/i })).toBeVisible();
    await expect(page.getByText(/Delhi Public School/i)).toBeVisible();
  });

  test("marketplace conference exposes Indian committee formats via API", async ({ request }) => {
    const res = await request.get("/api/marketplace/global-summit-mun-2026");
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as { conference?: { title?: string } };
    expect(data.conference?.title).toContain("Tidingz MUN");
  });

  test("organizer delegations API returns seed delegation", async ({ request }) => {
    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const res = await request.get(`/api/organizers/conferences/${SEED_EVENT_ID}/delegations`);
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as {
      delegations?: Array<{ schoolName?: string }>;
    };
    expect(data.delegations?.some((entry) => entry.schoolName === "Delhi Public School")).toBeTruthy();
  });

  test("delegate can list position paper and awards APIs when logged in", async ({ request }) => {
    const login = await loginWithCredentials(request, "delegate1@tidingz.demo", SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const awards = await request.get(`/api/registrations/${SEED_REGISTRATION_ALLOTTED}/awards`);
    expect(awards.ok()).toBeTruthy();
    const awardData = (await awards.json()) as { awards?: unknown[] };
    expect((awardData.awards || []).length).toBeGreaterThan(0);

    const paper = await request.get(`/api/registrations/${SEED_REGISTRATION_ALLOTTED}/position-paper`);
    expect(paper.ok()).toBeTruthy();
  });
});
