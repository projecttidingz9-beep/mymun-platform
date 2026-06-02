#!/usr/bin/env node
/**
 * Verifies required production environment variables.
 * Usage: NODE_ENV=production node scripts/verify-production-env.mjs
 * Or load .env.vercel.production first in your shell.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnvFile(".env");
loadDotEnvFile(".env.local");
loadDotEnvFile(".env.vercel.production");

const required = [
  "DATABASE_URL",
  "AUTH_SESSION_SECRET",
  "PASS_QR_SECRET",
  "ADMIN_EMAIL",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

const recommended = [
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
];

const missing = required.filter((k) => !process.env[k]?.trim());
const weak = recommended.filter((k) => !process.env[k]?.trim());

if (missing.length) {
  console.error("Missing required production variables:");
  missing.forEach((k) => console.error("  -", k));
  process.exit(1);
}

if (weak.length) {
  console.warn("Recommended variables not set:");
  weak.forEach((k) => console.warn("  -", k));
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
if (appUrl && !appUrl.startsWith("https://")) {
  console.warn("NEXT_PUBLIC_APP_URL should use https:// in production:", appUrl);
}

console.log("Production environment check passed.");
