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

const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SESSION_SECRET",
  "PASS_QR_SECRET",
  "ADMIN_EMAIL",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PAYMENTS_MODE",
];

const SKIP_EMPTY = new Set(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\r/g, "").trim();
    out[key] = val;
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
    throw new Error(`vercel env add ${name} ${target} failed: ${err}`);
  }
}

if (!existsSync(envPath)) {
  console.error("Missing .env.local — copy from .env.example first.");
  process.exit(1);
}

const parsed = parseEnvFile(readFileSync(envPath, "utf8"));
const targets = ["production", "preview"];
let synced = 0;

for (const key of KEYS) {
  const value = parsed[key];
  if (!value) {
    if (!SKIP_EMPTY.has(key)) {
      console.warn(`skip ${key}: not set in .env.local`);
    }
    continue;
  }
  for (const target of targets) {
    setVercelEnv(key, value, target);
    synced++;
    console.log(`ok ${key} → ${target}`);
  }
}

console.log(`Synced ${synced} variable targets from .env.local`);
