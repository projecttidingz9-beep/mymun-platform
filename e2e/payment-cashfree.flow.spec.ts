import { test, expect } from "@playwright/test";
import {
  SEED_EVENT_ID,
  SEED_EVENT_SLUG,
  SEED_ORGANIZER_EMAIL,
  SEED_PASSWORD,
  isSeedCatalogLoaded,
  loginWithCredentials,
} from "./helpers/seed";

test.describe("Cashfree payment flow (API)", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ request }) => {
    const loaded = await isSeedCatalogLoaded(request);
    test.skip(!loaded, "Run npm run db:seed against DATABASE_URL before E2E.");
  });

  test("checkout-config loads for seeded conference", async ({ request }) => {
    const res = await request.get(`/api/marketplace/${SEED_EVENT_SLUG}/checkout-config`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { eventId?: string; registrationCategories?: unknown[] };
    expect(body.eventId).toBe(SEED_EVENT_ID);
    expect(Array.isArray(body.registrationCategories)).toBeTruthy();
    expect((body.registrationCategories || []).length).toBeGreaterThan(0);
  });

  test("delegate registration rejects invalid phone", async ({ request }) => {
    const login = await loginWithCredentials(request, "delegate3@tidingz.demo", SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const configRes = await request.get(`/api/marketplace/${SEED_EVENT_SLUG}/checkout-config`);
    const config = (await configRes.json()) as {
      registrationCategories?: Array<{ id: string; name: string }>;
      committees?: Array<{ id: string; name: string }>;
    };
    const category = config.registrationCategories?.[0];
    const committee = config.committees?.[0];
    expect(category).toBeTruthy();
    expect(committee).toBeTruthy();

    const reg = await request.post("/api/registrations", {
      data: {
        registrationId: `reg-e2e-bad-phone-${Date.now()}`,
        eventId: SEED_EVENT_ID,
        categoryId: category!.id,
        categoryName: category!.name,
        fullName: "Bad Phone User",
        school: "Test School",
        formAnswers: { phone: "12345" },
        committeeConfigId: committee!.id,
        committeePreferences: [committee!.id],
      },
    });
    expect(reg.status()).toBe(400);
  });

  test("cashfree order endpoint requires auth", async ({ request }) => {
    const res = await request.post("/api/payments/cashfree/orders", {
      data: { paymentIntentId: "fake", eventId: SEED_EVENT_SLUG },
    });
    expect(res.status()).toBe(401);
  });

  test("organizer sees paid registrations in my-events", async ({ request }) => {
    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const res = await request.get("/api/organizers/my-events");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      conferences?: Array<{
        id: string;
        applicants?: Array<{ paid?: boolean; paymentProvider?: string; amount?: number }>;
      }>;
    };
    const conference = body.conferences?.find((c) => c.id === SEED_EVENT_ID);
    expect(conference).toBeTruthy();
    const paidApplicants = (conference?.applicants || []).filter((a) => a.paid);
    expect(paidApplicants.length).toBeGreaterThan(0);
    const cashfreePaid = paidApplicants.some((a) => a.paymentProvider === "CASHFREE");
    expect(cashfreePaid).toBeTruthy();
  });
});
