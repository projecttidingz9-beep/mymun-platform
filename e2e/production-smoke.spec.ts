import { test, expect } from "@playwright/test";

const isProdTarget = (process.env.PLAYWRIGHT_BASE_URL || "").includes("tidingz.com");

test.describe("Production smoke @production", () => {
  test.skip(!isProdTarget, "Set PLAYWRIGHT_BASE_URL=https://tidingz.com to run production smoke tests");

  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Tidingz/i);
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  });

  test("marketplace loads", async ({ page }) => {
    await page.goto("/conferences");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("legal terms page", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
  });

  test("health API", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { ok?: boolean };
    expect(json.ok).toBe(true);
  });

  test("brand logo asset", async ({ request }) => {
    const res = await request.get("/brand/logo-horizontal-light.png");
    expect(res.status()).toBe(200);
  });
});
