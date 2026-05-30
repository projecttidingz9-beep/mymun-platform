/**
 * Sync selected keys from .env.local to Vercel (production + preview).
 * Usage: node scripts/sync-vercel-env.mjs
 * Requires: vercel CLI logged in, project linked (.vercel/)
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");
const vercelEnvFallbackPath = resolve(root, ".env.vercel.production");

const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SESSION_SECRET",
  "PASS_QR_SECRET",
  "ADMIN_EMAIL",
  "NEXT_PUBLIC_ADMIN_EMAIL",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PAYMENTS_MODE",
];

const SKIP_IF_EMPTY = new Set(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

/** Match env.ts normalizeEnvString — strip CRLF, newlines, wrapping quotes. */
function normalizeEnvString(val) {
  if (typeof val !== "string") return "";
  let s = val.replace(/\r/g, "").replace(/\n/g, "").trim();
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = normalizeEnvString(trimmed.slice(eq + 1));
    if (val) out[key] = val;
  }
  return out;
}

function setVercelEnv(name, value, target) {
  const result = spawnSync(
    "vercel",
    ["env", "add", name, target, "--force", "--sensitive"],
    {
      cwd: root,
      input: value,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    }
  );
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    if (/already exists/i.test(err) && !/--force/.test(err)) {
      throw new Error(`vercel env add ${name} ${target} failed: ${err}`);
    }
    if (result.status !== 0 && !/Overrode Environment Variable/i.test(result.stdout || "")) {
      throw new Error(`vercel env add ${name} ${target} failed: ${err}`);
    }
  }
}

if (!existsSync(envPath)) {
  console.error("Missing .env.local — copy from .env.example first.");
  process.exit(1);
}

const parsed = parseEnvFile(readFileSync(envPath, "utf8"));

if (
  !parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  existsSync(vercelEnvFallbackPath)
) {
  const fallback = parseEnvFile(readFileSync(vercelEnvFallbackPath, "utf8"));
  if (fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY = fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    console.log("Using NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.vercel.production");
  }
}

if (!parsed.PAYMENTS_MODE) {
  parsed.PAYMENTS_MODE = "manual";
}

if (parsed.ADMIN_EMAIL && !parsed.NEXT_PUBLIC_ADMIN_EMAIL) {
  parsed.NEXT_PUBLIC_ADMIN_EMAIL = parsed.ADMIN_EMAIL;
}

const targets = ["production", "preview"];
let synced = 0;
let skipped = 0;

for (const key of KEYS) {
  const value = parsed[key];
  if (!value) {
    if (!SKIP_IF_EMPTY.has(key)) {
      console.warn(`skip ${key}: not set in .env.local`);
    }
    skipped++;
    continue;
  }
  for (const target of targets) {
    try {
      setVercelEnv(key, value, target);
      synced++;
      console.log(`ok ${key} → ${target}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exists/i.test(msg) && key.startsWith("NEXT_PUBLIC_SUPABASE")) {
        console.warn(`skip ${key} → ${target}: managed by Supabase integration`);
        skipped++;
      } else {
        throw e;
      }
    }
  }
}

console.log(`Synced ${synced} variable targets (${skipped} skipped) from .env.local`);
