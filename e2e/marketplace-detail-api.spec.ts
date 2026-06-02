import { test, expect } from "@playwright/test";

test("public marketplace detail API returns 404 for unknown conference", async ({ request }) => {
  const res = await request.get("/api/marketplace/nonexistent-conference-id-e2e");
  expect(res.status()).toBe(404);
});

test("marketplace catalog API responds with conferences array", async ({ request }) => {
  const res = await request.get("/api/marketplace");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { conferences?: unknown[] };
  expect(Array.isArray(body.conferences)).toBe(true);
});
