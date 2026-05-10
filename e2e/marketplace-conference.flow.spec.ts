import { test, expect } from "@playwright/test";

/**
 * When the catalog has conferences (seed/staging/prod), ensures Marketplace links into a conference page.
 * Skips automatically when no `/conference/:id` links are rendered.
 */
test("marketplace → conference detail when listings exist", async ({ page }) => {
  await page.goto("/marketplace");
  await page.waitForLoadState("networkidle");

  const conferenceLinks = page.locator('a[href^="/conference/"]');
  if ((await conferenceLinks.count()) === 0) {
    test.skip();
    return;
  }

  const conferenceLink = conferenceLinks.first();
  await Promise.all([
    page.waitForURL(/\/conference\/[^/?#]+$/),
    conferenceLink.click(),
  ]);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
});
