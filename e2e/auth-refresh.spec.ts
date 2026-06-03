import { test, expect } from "@playwright/test";
import { SEED_DELEGATE_EMAIL, SEED_PASSWORD, isSeedCatalogLoaded } from "./helpers/seed";

test.describe("auth session survives page reload", () => {
  test.beforeEach(async ({ request }) => {
    const loaded = await isSeedCatalogLoaded(request);
    test.skip(!loaded, "Run npm run db:seed against DATABASE_URL before E2E.");
  });

  test("delegate dashboard stays on /dashboard after reload", async ({ page, request }) => {
    const login = await page.request.post("/api/auth/login", {
      data: { email: SEED_DELEGATE_EMAIL, password: SEED_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("navigation")).toBeVisible();
  });
});
