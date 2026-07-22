/**
 * Soft-delete every conference so the marketplace is empty.
 * Keeps user accounts intact.
 *
 * Option A (recommended — injects secrets into the process):
 *   $env:ALLOW_WIPE_CONFERENCES="true"
 *   $env:ALLOW_DESTRUCTIVE_SEED="true"
 *   npx vercel env run -e production -- npx tsx scripts/wipe-production-conferences.ts
 *
 * Option B (pulls .env.wipe.local then wipes):
 *   npx vercel env pull .env.wipe.local --environment production --yes
 *   $env:ALLOW_WIPE_CONFERENCES="true"
 *   $env:ALLOW_DESTRUCTIVE_SEED="true"
 *   npx tsx scripts/wipe-production-conferences.ts
 *
 * Option C (you already have DATABASE_URL in the shell):
 *   $env:DATABASE_URL="postgresql://..."
 *   $env:ALLOW_WIPE_CONFERENCES="true"
 *   $env:ALLOW_DESTRUCTIVE_SEED="true"
 *   npx tsx scripts/wipe-production-conferences.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const ENV_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_URL",
] as const;

function normalize(val: string | undefined): string {
  if (!val) return "";
  let s = val.replace(/\r/g, "").replace(/\n/g, "").trim();
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = normalize(trimmed.slice(eq + 1));
  }
  return out;
}

function pickDatabaseUrl(source: Record<string, string | undefined>): {
  url: string;
  key: string | null;
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  for (const key of ENV_CANDIDATES) {
    const value = normalize(source[key]);
    if (!value) {
      diagnostics.push(`${key}: missing`);
      continue;
    }
    const looksPg = /^(postgres|postgresql)(\+[^:]+)?:\/\//i.test(value);
    const placeholder = /SENSITIVE|placeholder|example\.com|changeme/i.test(value);
    diagnostics.push(
      `${key}: len=${value.length} looksPostgres=${looksPg} placeholder=${placeholder}`
    );
    if (looksPg && !placeholder) {
      // Prisma/pg accept postgresql:// ; strip prisma+ if present for pg.Pool
      const url = value.replace(/^postgres(ql)?\+[^:]+/i, "postgresql");
      return { url, key, diagnostics };
    }
  }
  return { url: "", key: null, diagnostics };
}

function loadFromEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  return parseEnvFile(readFileSync(filePath, "utf8"));
}

function tryPullEnvFile(targetPath: string): boolean {
  console.log(`Pulling production env to ${targetPath}...`);
  const pull = spawnSync(
    "npx",
    ["vercel", "env", "pull", targetPath, "--environment", "production", "--yes"],
    { encoding: "utf8", shell: true, cwd: process.cwd() }
  );
  if (pull.status !== 0) {
    console.error((pull.stderr || pull.stdout || "vercel env pull failed").slice(0, 800));
    return false;
  }
  return existsSync(targetPath);
}

async function main() {
  if (process.env.ALLOW_WIPE_CONFERENCES !== "true") {
    console.error("Refusing: set ALLOW_WIPE_CONFERENCES=true");
    process.exit(1);
  }
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    console.error("Refusing: set ALLOW_DESTRUCTIVE_SEED=true");
    process.exit(1);
  }

  const wipeEnvPath = resolve(process.cwd(), ".env.wipe.local");
  const localEnvPath = resolve(process.cwd(), ".env.local");

  // 1) Prefer already-injected env (vercel env run / manual DATABASE_URL)
  let picked = pickDatabaseUrl(process.env as Record<string, string | undefined>);
  if (picked.url) {
    console.log(`Using ${picked.key} from process environment.`);
  }

  // 2) Existing pulled files
  if (!picked.url) {
    for (const path of [wipeEnvPath, localEnvPath]) {
      const fileEnv = loadFromEnvFile(path);
      picked = pickDatabaseUrl(fileEnv);
      if (picked.url) {
        console.log(`Using ${picked.key} from ${path}`);
        break;
      }
    }
  }

  // 3) Pull fresh into .env.wipe.local
  if (!picked.url) {
    if (tryPullEnvFile(wipeEnvPath)) {
      picked = pickDatabaseUrl(loadFromEnvFile(wipeEnvPath));
      if (picked.url) {
        console.log(`Using ${picked.key} from freshly pulled .env.wipe.local`);
      }
    }
  }

  if (!picked.url) {
    console.error("No usable Postgres URL found.");
    console.error("Diagnostics:");
    for (const line of picked.diagnostics) console.error(`  ${line}`);
    console.error(
      [
        "",
        "Fix: run this instead (injects secrets without writing a file):",
        '  $env:ALLOW_WIPE_CONFERENCES="true"',
        '  $env:ALLOW_DESTRUCTIVE_SEED="true"',
        "  npx vercel env run -e production -- npx tsx scripts/wipe-production-conferences.ts",
        "",
        "Or paste DATABASE_URL from Vercel → Project → Settings → Environment Variables, then:",
        '  $env:DATABASE_URL="postgresql://..."',
        '  $env:ALLOW_WIPE_CONFERENCES="true"',
        '  $env:ALLOW_DESTRUCTIVE_SEED="true"',
        "  npx tsx scripts/wipe-production-conferences.ts",
      ].join("\n")
    );
    process.exit(1);
  }

  const isLocal =
    /localhost|127\.0\.0\.1/i.test(picked.url) ||
    picked.url.includes("_build_placeholder");
  if (!isLocal && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    console.error("Refusing remote wipe without ALLOW_DESTRUCTIVE_SEED=true");
    process.exit(1);
  }

  console.log("Connecting and soft-deleting conferences...");
  const pool = new Pool({
    connectionString: picked.url,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const events = await prisma.event.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    if (events.length === 0) {
      console.log("No active conferences found. Marketplace is already empty.");
      return;
    }

    console.log(`Soft-deleting ${events.length} conference(s)...`);
    const deletedAt = new Date();
    for (const event of events) {
      await prisma.event.update({
        where: { id: event.id },
        data: { deletedAt },
      });
      console.log(`  OK ${event.status} · ${event.title}`);
    }

    const remaining = await prisma.event.count({ where: { deletedAt: null } });
    console.log(`Done. Active conferences remaining: ${remaining}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
    try {
      if (existsSync(wipeEnvPath)) unlinkSync(wipeEnvPath);
    } catch {
      // ignore
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
