# Deploying on Vercel

This project targets **Vercel** for production hosting with **PostgreSQL** (e.g. Supabase) and Prisma.

## 1. Prerequisites

- Git repository connected to Vercel.
- Supabase (or other Postgres) with migrations applied: `npx prisma migrate deploy` using `DIRECT_URL`.
- Domain DNS pointed at Vercel when going live.

## 2. Environment variables

In **Vercel → Project → Settings → Environment Variables**, add every key from [`.env.example`](../.env.example) for **Production**, **Preview**, and **Development** as needed.

Critical:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Transaction pooler `:6543` + `pgbouncer=true` + `sslmode=require`. |
| `DIRECT_URL` | Session pooler `:5432` (IPv4-friendly) or direct DB — used by Prisma CLI / migrations locally and in CI. |
| `AUTH_SESSION_SECRET` | Long random string; rotate invalidates sessions unless you migrate tokens. |
| `PASS_QR_SECRET` | Separate secret for QR signing. |
| `ADMIN_EMAIL` | Super-admin email; must match the `User` row you set to `ADMIN` for `/admin` and `/api/admin/*`. |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Same value as `ADMIN_EMAIL` — Super Dashboard nav link visibility in the UI. |
| `NEXT_PUBLIC_APP_URL` | **HTTPS** production URL, e.g. `https://your-domain.com`. |

Optional: `RESEND_*`, **`NEXT_PUBLIC_SUPABASE_URL`** + **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (Supabase Auth — Google OAuth via redirect to `/auth/callback`; configure providers and redirect URLs in the Supabase dashboard), legacy Google GIS (`GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` only if Supabase Auth is not configured), `SENTRY_DSN` (server/edge) and `NEXT_PUBLIC_SENTRY_DSN`. Set `SENTRY_AUTH_TOKEN` in CI or Vercel when you want **source maps uploaded** during build (`next.config` disables upload when this is unset).

Set `DB_POOL_MAX` low per isolate (e.g. **5–10**) if you see Supabase connection limits under load.

## 3. Build command

Default Vercel Next.js build is fine if **`postinstall` or build runs Prisma generate**.

Recommended **Install Command**:

```bash
npm ci && npx prisma generate
```

**Build Command**:

```bash
npm run build
```

Do **not** run `prisma migrate deploy` inside Vercel’s build unless you use a dedicated migration step with secrets; prefer:

- **[`.github/workflows/migrate-production.yml`](../.github/workflows/migrate-production.yml)** — runs `npx prisma migrate deploy` on every push to `master` / `main` (requires `DATABASE_URL` and `DIRECT_URL` in the GitHub **production** environment secrets), or  
- Manual `migrate deploy` before/after first deploy.

If login succeeds but the UI shows a session/profile error after deploy, check that this workflow ran successfully and that all migrations (including the latest feature pack) appear in `npx prisma migrate status`.

## 4. Database migrations

After connecting `DATABASE_URL`:

```bash
npx prisma migrate deploy
```

Use `DIRECT_URL` in CI/local per [`prisma.config.ts`](../prisma.config.ts).

## 5. Runtime notes

- **`next.config.ts`** sets response headers (including HSTS in production, COOP, and security headers) and Next/Image `remotePatterns`.
- Prisma uses a **singleton** `pg` pool in [`src/lib/server/prisma.ts`](../src/lib/server/prisma.ts) to limit connections per serverless instance.

## 6. Post-deploy smoke test

1. `GET /api/health` — must return `"ok":true` with `dbLatencyMs` (if `ok:false`, check `DATABASE_URL` / `AUTH_SESSION_SECRET` on Vercel and redeploy).
2. Sign up / login / marketplace load.
3. Forgot-password only sends mail when `RESEND_*` set (no reset URLs in logs).

Re-sync secrets from local after editing `.env.local`:

```bash
node scripts/sync-vercel-env.mjs
vercel deploy --prod --yes
```

## 7. GitHub tag release (migrations)

Pushing a tag `v*` runs [`.github/workflows/release.yml`](../.github/workflows/release.yml). Configure a **GitHub Environment** named `production` with secrets:

- `DATABASE_URL` — same pooled URL as Vercel (or a migration-only user).
- `DIRECT_URL` — session pooler or direct host for `prisma migrate deploy`.

The workflow runs `npx prisma migrate deploy` then `npm run build`. Add a Vercel deploy step (CLI or `amondnet/vercel-action`) when you are ready to promote builds from tags.

## 8. Environment checklist (copy-paste)

- [ ] `NEXT_PUBLIC_APP_URL` = `https://<your-domain>` (no trailing slash).
- [ ] If using Supabase OAuth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and redirect URLs `https://<your-domain>/auth/callback` (+ localhost for dev) in the Supabase dashboard.
- [ ] `DATABASE_URL` and `DIRECT_URL` set in Vercel **and** local `.env` / `.env.local`.
- [ ] `AUTH_SESSION_SECRET` / `PASS_QR_SECRET` are long random strings (not committed).
- [ ] `ADMIN_EMAIL` is set (same value as in local; must match the account you use for `/admin`).
- [ ] **Do not** set `DATABASE_SSL_REJECT_UNAUTHORIZED` in Vercel **Production** (omit it so Postgres TLS is verified). Use that flag **only** in local `.env.local` if you hit corporate SSL inspection errors.
- [ ] Mirror other keys from [`.env.example`](../.env.example) (`RESEND_*`, `PAYMENTS_MODE`, optional Supabase OAuth, Sentry) so preview/prod match launch needs.
- [ ] `postinstall` runs `prisma generate` (see `package.json`).
- [ ] First production deploy: run `npx prisma migrate deploy` (or use the tag workflow) **before** traffic.

## 9. Bootstrap super-admin (one-time)

Super-admin access requires **`ADMIN_EMAIL`** on Vercel (must match the account email) and a **`User`** row with `role = ADMIN` and a password hash. Public registration cannot create `ADMIN` users.

From the project root, with **production** `DATABASE_URL` / `DIRECT_URL` loaded (e.g. in `.env.local` — same DB as Vercel):

```bash
BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='your-secure-password' npm run bootstrap:admin
```

Optional: `BOOTSTRAP_ADMIN_NAME`. Do **not** commit `BOOTSTRAP_ADMIN_PASSWORD` or store it in Vercel env. After upsert, set `ADMIN_EMAIL` to the same address, redeploy, sign in on production, then open `/admin`.

**Moderation workflow:** Organizers publish → `REVIEW` in the database. Super-admin uses `/admin` (Review queue) to **Approve** (`PUBLISHED`, marketplace-visible) or **Reject** (returns to `DRAFT` with optional feedback). Configure `RESEND_*` to email organizers on decisions.

## 10. Rollback

Revert deployment in Vercel dashboard or redeploy previous Git tag. Schema rollback requires a **forward** migration — avoid destructive down migrations in prod.

## 11. Email verification (v1)

`/api/auth/verify-email` is intentionally **not implemented** for launch. Policy and follow-up work are documented in [`docs/email-verification.md`](./email-verification.md).
