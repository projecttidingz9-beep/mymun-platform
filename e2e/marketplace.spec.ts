import { test, expect } from "@playwright/test";

test("marketplace loads", async ({ page }) => {
  await page.goto("/conferences");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Find your next/i);
});
