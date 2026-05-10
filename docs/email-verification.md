# Email verification (v1)

The HTTP route [`src/app/api/auth/verify-email/route.ts`](../src/app/api/auth/verify-email/route.ts) intentionally returns **501 Not Implemented**. Outbound verification mail and durable tokens are deferred until after launch.

**v1 acceptance:** New accounts are created without a separate email-verification step. Risk: anyone who can receive password-reset mail at an address effectively controls that account once reset is used; for launch we rely on **password strength**, **rate limits** on auth endpoints, and **monitoring** (e.g. Sentry) for abuse.

Before enabling verification in production, implement: signed time-limited tokens, store pending state on `User` or a dedicated table, Resend template for the verify link, and success/error pages.
