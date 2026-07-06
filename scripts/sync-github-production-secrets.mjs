/**
 * Sync DATABASE_URL and DIRECT_URL from .env.local to GitHub Environment secrets
 * (Production). Required for `.github/workflows/migrate-production.yml`.
 *
 * Usage:
 *   gh auth login   # once, with repo admin + secrets scope
 *   node scripts/sync-github-production-secrets.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");
const GITHUB_ENV = "Production";

const KEYS = ["DATABASE_URL", "DIRECT_URL"];

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

function ghSecretSet(name, value) {
  const result = spawnSync("gh", ["secret", "set", name, "-e", GITHUB_ENV, "--body", value], {
    cwd: root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `gh secret set ${name} failed: ${(result.stderr || result.stdout || "").trim() || "unknown error"}`
    );
  }
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Add DATABASE_URL and DIRECT_URL first.`);
  process.exit(1);
}

const env = parseEnvFile(readFileSync(envPath, "utf8"));
const databaseUrl = env.DATABASE_URL;
const directUrl = env.DIRECT_URL || databaseUrl;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const auth = spawnSync("gh", ["auth", "status"], { encoding: "utf8", shell: process.platform === "win32" });
if (auth.status !== 0) {
  console.error("GitHub CLI is not authenticated. Run: gh auth login");
  process.exit(1);
}

console.log(`Syncing ${KEYS.join(", ")} to GitHub environment "${GITHUB_ENV}"…`);
ghSecretSet("DATABASE_URL", databaseUrl);
ghSecretSet("DIRECT_URL", directUrl);
console.log("Done. Re-run the failed “Migrate production database” workflow on GitHub Actions.");
