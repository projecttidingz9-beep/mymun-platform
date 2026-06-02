#!/usr/bin/env node
/**
 * Pre-launch verification helper (run against production).
 *
 *   node scripts/verify-production-env.mjs
 *   PLAYWRIGHT_BASE_URL=https://tidingz.com npm run test:e2e:prod
 *
 * Manual steps (cannot be automated here):
 * - Google OAuth sign-in on https://tidingz.com
 * - Trigger password reset / organizer status / moderation emails in Resend dashboard
 * - Confirm Sentry receives a test error (temporarily throw in a staging route or use Sentry test button)
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PLAYWRIGHT_BASE_URL || "https://tidingz.com";

console.log("=== Tidingz pre-launch check ===\n");

const envCheck = spawnSync("node", ["scripts/verify-production-env.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
if (envCheck.status !== 0) process.exit(envCheck.status ?? 1);

console.log(`\nFetching ${base}/api/health ...`);
try {
  const res = await fetch(`${base}/api/health`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok !== true) {
    console.error("Health check failed:", res.status, body);
    process.exit(1);
  }
  console.log("Health OK:", body);
} catch (err) {
  console.error("Could not reach production health endpoint:", err);
  process.exit(1);
}

console.log("\nNext: run Playwright against production:");
console.log(`  PLAYWRIGHT_BASE_URL=${base} npm run test:e2e:prod`);
console.log("\nManual: OAuth on live domain, email smoke tests, Sentry test event.");
