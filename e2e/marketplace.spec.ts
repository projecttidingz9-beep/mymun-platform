import { test, expect } from "@playwright/test";

test("marketplace loads", async ({ page }) => {
  await page.goto("/marketplace");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Find your next/i);
});
