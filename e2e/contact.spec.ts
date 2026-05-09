import { test, expect } from "@playwright/test";

test("contact page loads", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
});
