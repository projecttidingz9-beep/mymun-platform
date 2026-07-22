/**
 * Soft-delete every conference so the marketplace is empty.
 * Keeps user accounts intact.
 *
 *   ALLOW_WIPE_CONFERENCES=true ALLOW_DESTRUCTIVE_SEED=true npx vercel env run -e production -- npx tsx scripts/wipe-all-conferences.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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

async function main() {
  if (process.env.ALLOW_WIPE_CONFERENCES !== "true") {
    console.error("Refusing: set ALLOW_WIPE_CONFERENCES=true");
    process.exit(1);
  }

  const candidates = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "DIRECT_URL",
  ];
  const present = candidates.filter((k) => Boolean(normalize(process.env[k])));
  console.log(`DB env keys present: ${present.join(", ") || "(none)"}`);

  const databaseUrl =
    normalize(process.env.DATABASE_URL) ||
    normalize(process.env.POSTGRES_PRISMA_URL) ||
    normalize(process.env.POSTGRES_URL) ||
    normalize(process.env.POSTGRES_URL_NON_POOLING) ||
    normalize(process.env.DIRECT_URL);

  if (!/^(postgres|postgresql):\/\//i.test(databaseUrl)) {
    console.error(
      "No usable Postgres URL in environment. Ensure vercel env run -e production injects DATABASE_URL."
    );
    process.exit(1);
  }

  const isLocal =
    /localhost|127\.0\.0\.1/i.test(databaseUrl) ||
    databaseUrl.includes("_build_placeholder");
  if (!isLocal && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    console.error("Refusing remote wipe without ALLOW_DESTRUCTIVE_SEED=true");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
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
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
