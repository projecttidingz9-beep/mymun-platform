# Tidingz (mymun-platform)

Production-oriented Model UN platform: marketplace, delegate flows, organizer dashboards, and manual/free checkout — Next.js App Router + PostgreSQL (Prisma).

## Scripts

| Command | Purpose |
| -------- | ------- |
| `npm run dev` | Local dev server |
| `npm run build` / `npm run start` | Production build & serve |
| `npm run lint` / `npm run typecheck` | Quality gates |
| `npm run test` | Vitest unit/integration tests |
| `npm run test:e2e` | Playwright (starts dev server locally unless `CI=true`) |
| `npm run prisma:generate` | Generate Prisma client into `src/generated/prisma` |
| `npm run prisma:migrate` | Dev migrations |
| `npm run prisma:migrate:deploy` | Prod/staging `migrate deploy` |
| `npm run db:seed` | Seed demo data |

## Environment

Copy [`.env.example`](./.env.example) → `.env.local`. For **Vercel**, see [`docs/deploy-vercel.md`](docs/deploy-vercel.md). Critical vars:

- **`DATABASE_URL`** / **`DIRECT_URL`** — Postgres (e.g. Supabase).
- **`AUTH_SESSION_SECRET`** — JWT signing for `mymun_session`.
- **`PASS_QR_SECRET`** — Delegate pass QR signing.
- **`ADMIN_EMAIL`** — Super-admin email (must match the logged-in user’s email for `/admin` and `/api/admin/*`; pair with `User.role = ADMIN` in the database).
- **`NEXT_PUBLIC_APP_URL`** — Canonical URL for metadata, emails, sitemap.

Optional: Google OAuth (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`), Resend (`RESEND_*`), Sentry (`SENTRY_DSN` — wire in `src/instrumentation.ts`).

## Architecture & ops

- **`docs/architecture.md`** — stack and boundaries.
- **`docs/payments.md`** — FREE/MANUAL checkout model.
- **`docs/runbook.md`** — deploy, incidents, session revocation.

## Auth notes

- Sessions include **`sub`** (user id) + **`sv`** (`User.sessionVersion`). Call **`POST /api/auth/logout-all`** to invalidate every device.
- Password login applies **lockout** after repeated failures (see runbook).

## CI

GitHub Actions **`ci.yml`**: install → prisma generate → lint → typecheck → tests → build → Playwright smoke → build artifact.

Additional workflows: **`preview.yml`**, **`release.yml`** (template — add host + secrets).

## Cloudflare / OpenNext

See `npm run cf:*` scripts for Workers-oriented builds.
