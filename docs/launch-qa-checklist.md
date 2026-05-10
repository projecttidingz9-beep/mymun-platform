# Launch QA checklist (manual)

Run through once on **production** (or staging with production-like env) before announcing go-live.

**Automated coverage (CI):** Vitest exercises `/api/passes/me` release gating, forgot-password log hygiene, and duplicate registration; Playwright includes marketplace smoke and an optional marketplace→conference navigation when the catalog is non-empty.

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
