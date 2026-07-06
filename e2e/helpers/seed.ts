/** Stable IDs and credentials from prisma/seed.ts */
export const SEED_EVENT_ID = "evt-seed-global-summit-2026";
export const SEED_EVENT_SLUG = "global-summit-mun-2026";
export const SEED_ORGANIZER_EMAIL = "organizer1@tidingz.demo";
export const SEED_DELEGATE_EMAIL = "delegate1@tidingz.demo";
export const SEED_PASSWORD = "TidingzDemo1";
export const SEED_REGISTRATION_ALLOTTED = "reg-seed-001";
export const SEED_REGISTRATION_PENDING = "reg-seed-002";

/** Optional QA mock conference from `npm run test:mock-mun` — not part of prisma seed. */
export const QA_MOCK_EVENT_ID = "evt-qa-mock-mun-2026";

export async function isSeedCatalogLoaded(
  request: { get: (url: string) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }> }
): Promise<boolean> {
  const res = await request.get("/api/marketplace");
  if (!res.ok()) return false;
  const body = (await res.json()) as { conferences?: Array<{ id: string }> };
  return Array.isArray(body.conferences) && body.conferences.some((c) => c.id === SEED_EVENT_ID);
}

export async function isQaMockConferenceLoaded(
  request: { get: (url: string) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }> }
): Promise<boolean> {
  const res = await request.get("/api/marketplace");
  if (!res.ok()) return false;
  const body = (await res.json()) as { conferences?: Array<{ id: string }> };
  return Array.isArray(body.conferences) && body.conferences.some((c) => c.id === QA_MOCK_EVENT_ID);
}

export async function loginWithCredentials(
  request: {
    post: (
      url: string,
      options: { data: { email: string; password: string } }
    ) => Promise<{ ok: () => boolean }>;
  },
  email: string,
  password: string = SEED_PASSWORD
) {
  const res = await request.post("/api/auth/login", {
    data: { email, password },
  });
  return res;
}
