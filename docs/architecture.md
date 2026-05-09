# Architecture

## Stack

- **Framework**: Next.js App Router (React 19), TypeScript.
- **Database**: PostgreSQL via Prisma 7 + `@prisma/adapter-pg` connection pooling.
- **Auth**: JWT session cookie `mymun_session` (HS256, `AUTH_SESSION_SECRET`), optional Bearer token for APIs.
- **Email**: Resend (when API keys are present).

## Runtime boundaries

- **`src/proxy.ts`**: Network boundary for cookie/Bearer checks on selected `/api/*` routes (session validity + role hints).
- **`src/lib/server/auth.ts`**: `validateSessionToken` ties JWT claims to `User.sessionVersion` (sign-out everywhere), lockout, and soft-delete.
- **`src/lib/server/env.ts`**: Zod-validated environment variables; build-time placeholders when secrets are absent during `next build`.

## Data model highlights

- **Event** + **OrganizerConferenceConfig** hold public/conference metadata.
- **Registration** + **PaymentIntent** power checkout (FREE / MANUAL providers).
- **EventTeamMember** + **Event.ownerUserId** gate organizer APIs alongside legacy preview JSON for migration.

## Client state

- **`AuthProvider`**: Loads session from `/api/auth/session`, caches organizer conferences for dashboards and marketplace composition.
