# Runbook

## Deploy checklist

1. **Env**: Set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SESSION_SECRET`, `PASS_QR_SECRET`, `NEXT_PUBLIC_APP_URL`, email keys as needed.
2. **DB**: `npx prisma migrate deploy` then optional `npm run db:seed` on staging only.
3. **Build**: `npm run build` — ensure Prisma client generates (`npm run prisma:generate` in CI).
4. **Smoke**: `GET /api/health` (200, `dbLatencyMs`), `GET /api/ready`, open `/marketplace`.

## Common incidents

| Symptom | Check |
| -------- | ----- |
| 401 on APIs | Cookie domain / HTTPS, `validateSessionToken`, `User.sessionVersion` bump |
| 423 on login | `User.lockedUntil` — wait window or reset in DB |
| Prisma errors | Migration drift vs prod — run `migrate deploy` |
| Static assets | `next.config` `images.remotePatterns` includes Supabase host |

## Session revocation

`POST /api/auth/logout-all` increments `User.sessionVersion`, invalidating all JWTs for that user.

## Rollback

- Revert deployment artifact; run backward-compatible migrations only. For breaking schema changes, restore DB snapshot.
