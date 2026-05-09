/** Next.js instrumentation hook — extend with @sentry/nextjs when DSN is configured. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Example:
    // const { init } = await import("@sentry/nextjs");
    // if (process.env.SENTRY_DSN) init({ dsn: process.env.SENTRY_DSN });
  }
}
