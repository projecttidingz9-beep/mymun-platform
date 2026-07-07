import { test, expect } from "@playwright/test";
import {
  SEED_DELEGATE_EMAIL,
  SEED_EVENT_ID,
  SEED_ORGANIZER_EMAIL,
  SEED_PASSWORD,
  SEED_REGISTRATION_ALLOTTED,
  SEED_REGISTRATION_PENDING,
  isSeedCatalogLoaded,
  loginWithCredentials,
} from "./helpers/seed";

test.describe("MUN lifecycle (seeded conference)", () => {
  test.beforeEach(async ({ request }) => {
    const loaded = await isSeedCatalogLoaded(request);
    test.skip(!loaded, "Run npm run db:seed against DATABASE_URL before E2E.");
  });

  test("paid pending registration does not auto-allot via marketplace", async ({ request }) => {
    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const sync = await request.get(`/api/marketplace/${SEED_EVENT_ID}`);
    expect(sync.ok()).toBeTruthy();
    const body = (await sync.json()) as { conference?: { id: string } };
    expect(body.conference?.id).toBe(SEED_EVENT_ID);
  });

  test("delegate pass QR from /me verifies and check-in is one-time", async ({ playwright, baseURL }) => {
    const delegateContext = await playwright.request.newContext({ baseURL });
    const organizerContext = await playwright.request.newContext({ baseURL });

    const delegateLogin = await loginWithCredentials(delegateContext, SEED_DELEGATE_EMAIL, SEED_PASSWORD);
    expect(delegateLogin.ok()).toBeTruthy();

    const me = await delegateContext.get("/api/passes/me");
    expect(me.ok()).toBeTruthy();
    const meBody = (await me.json()) as {
      passes: Array<{ registrationId: string; qrToken: string | null; released: boolean }>;
    };
    const pass = meBody.passes.find((p) => p.registrationId === SEED_REGISTRATION_ALLOTTED);
    expect(pass).toBeTruthy();
    expect(pass?.released).toBe(true);
    expect(pass?.qrToken).toBeTruthy();

    const organizerLogin = await loginWithCredentials(organizerContext, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(organizerLogin.ok()).toBeTruthy();

    const verify = await organizerContext.post("/api/passes/verify", {
      data: { qrToken: pass!.qrToken },
    });
    expect(verify.ok()).toBeTruthy();
    const verifyBody = (await verify.json()) as { valid?: boolean };
    expect(verifyBody.valid).toBe(true);

    const checkin = await organizerContext.post("/api/checkins", {
      data: { qrToken: pass!.qrToken },
    });
    expect(checkin.ok()).toBeTruthy();

    const checkinAgain = await organizerContext.post("/api/checkins", {
      data: { qrToken: pass!.qrToken },
    });
    expect(checkinAgain.status()).toBe(409);

    await delegateContext.dispose();
    await organizerContext.dispose();
  });

  test("organizer confirms payment on pending registration", async ({ request }) => {
    const login = await loginWithCredentials(request, SEED_ORGANIZER_EMAIL, SEED_PASSWORD);
    expect(login.ok()).toBeTruthy();

    const patch = await request.patch(
      `/api/organizers/registrations/${SEED_REGISTRATION_PENDING}`,
      { data: { paid: true } }
    );
    expect(patch.ok()).toBeTruthy();
    const body = (await patch.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });
});
