# Launch QA checklist (manual)

Run through once on **production** (or staging with production-like env) before announcing go-live.

**Automated coverage (CI):** Vitest exercises `/api/passes/me` release gating, forgot-password log hygiene, and duplicate registration; Playwright includes marketplace smoke and an optional marketplace→conference navigation when the catalog is non-empty.

## Pre-flight (before manual QA)

Complete these so login, register, and DB-backed routes work on the target environment:

1. **Database:** `DATABASE_URL` (pooler `:6543` + `pgbouncer=true`) and `DIRECT_URL` (session `:5432`) are set; run `npx prisma migrate deploy` (uses `DIRECT_URL` via [`prisma.config.ts`](../prisma.config.ts)) so all tables exist.
2. **Secrets:** `AUTH_SESSION_SECRET`, `PASS_QR_SECRET`, and `ADMIN_EMAIL` are set (see [`.env.example`](../.env.example)).
3. **App URL:** `NEXT_PUBLIC_APP_URL` is the canonical HTTPS site URL (see [deploy-vercel.md](./deploy-vercel.md) §8).
4. **Vercel / hosting:** Copy the same variable names from `.env.example` into the host dashboard; do **not** set `DATABASE_SSL_REJECT_UNAUTHORIZED` in production.
5. **Smoke:** `GET /api/health` returns `ok: true` with `dbLatencyMs`; then run the **Accounts** section below.

**Resend (password reset in production):** Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` with a verified sender; without them, forgot-password returns **503** in production (see `.env.example`).

**Google OAuth (optional):** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, add redirect URLs in Supabase (`https://<domain>/auth/callback` and `http://localhost:3000/auth/callback` for dev), and enable the Google provider — or use legacy `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` when Supabase Auth vars are unset (see deploy-vercel.md §2).

## Accounts

- [ ] Sign up as a new delegate; confirm session cookie and redirect behave as expected.
- [ ] Log out and log back in.
- [ ] Request password reset with `RESEND_*` configured — email arrives; reset completes (no reset URLs in server logs).
- [ ] Optional: confirm `GET /api/auth/verify-email` still returns 501 and product expectations match [email verification policy](./email-verification.md).

## Browse & SEO smoke

- [ ] Home, About, Contact load; navigation and footer legal links work (**Privacy**, **Terms**, **Refund**, **Cookies**).
- [ ] Marketplace lists conferences (or empty state).
- [ ] View page source on home: `metadataBase`/canonical and OG tags resolve to `NEXT_PUBLIC_APP_URL`.

## Delegate flow

- [ ] Open a conference from marketplace; complete registration for a **free** tier if available.
- [ ] Delegate dashboard / profile loads.

## Organizer flow

- [ ] Sign up or promote user as organizer (per your process).
- [ ] Create or edit a conference; confirm data persists.
- [ ] Issue or view delegate pass; confirm pass release time rules (no QR before release — see API tests / product spec).

## Ops

- [ ] `GET /api/health` returns OK with DB timing.
- [ ] Sentry shows a test error when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set (optional).
- [ ] No secrets or reset tokens in application logs.
