import { test, expect } from "@playwright/test";
import { isQaMockConferenceLoaded } from "./helpers/seed";

/**
 * UI smoke for QA mock conference. Requires `npm run test:mock-mun` setup on the
 * target database — skipped in CI and local dev when QA data is absent.
 */
const QA_EVENT_ID = "evt-qa-mock-mun-2026";
const QA_SLUG = "qa-mock-mun-2026";
const QA_TITLE_SNIPPET = "QA-TEST";

test.describe("Mock MUN UI walkthrough", () => {
  test.beforeEach(async ({ request }) => {
    const loaded = await isQaMockConferenceLoaded(request);
    test.skip(!loaded, "Run npm run test:mock-mun setup against DATABASE_URL before mock MUN UI E2E.");
  });

  test("marketplace lists QA conference card", async ({ page }) => {
    await page.goto("/conferences");
    await expect(page.getByText(new RegExp(QA_TITLE_SNIPPET, "i")).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("conference detail page renders committees", async ({ page }) => {
    await page.goto(`/conference/${QA_EVENT_ID}`);
    await expect(page.getByText(new RegExp(QA_TITLE_SNIPPET, "i")).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/UN Security Council|UNHRC|AIPPM|Press/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("conference detail by slug loads", async ({ page }) => {
    await page.goto(`/conference/${QA_SLUG}`);
    await expect(page.getByText(new RegExp(QA_TITLE_SNIPPET, "i")).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("checkout page loads for QA conference", async ({ page }) => {
    await page.goto(`/checkout/${QA_SLUG}`);
    await expect(
      page.getByRole("heading", { name: /checkout|register|delegate/i }).or(page.getByText(/Delegate Registration/i))
    ).toBeVisible({ timeout: 30_000 });
  });

  test("organizer dashboard loads when logged in", async ({ page, request }) => {
    const login = await request.post("/api/auth/login", {
      data: {
        email: "qa.organizer@tidingz-mocktest.invalid",
        password: "QaMockMun1",
      },
    });
    test.skip(!login.ok(), "QA organizer not seeded");

    await page.goto("/organizers/dashboard");
    await expect(page.getByText(new RegExp(QA_TITLE_SNIPPET, "i")).first()).toBeVisible({
      timeout: 35_000,
    });
  });
});
