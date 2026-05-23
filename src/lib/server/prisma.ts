import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { env } from "./env";

declare global {
  var __prisma__: PrismaClient | undefined;
  var __pg_pool__: Pool | undefined;
}

function sslRejectUnauthorizedDisabled(): boolean {
  const v = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  return v === "false" || v === "0";
}

/**
 * Pooled URL for runtime queries. When dev TLS bypass is enabled, rewrite sslmode:
 * pg v8+ treats `sslmode=require` as verify-full and ignores `rejectUnauthorized: false`.
 */
function connectionStringForPool(): string {
  const url = env.databaseUrl();
  if (!sslRejectUnauthorizedDisabled()) return url;
  if (/[?&]sslmode=/i.test(url)) {
    return url.replace(/([?&])sslmode=[^&]*/i, "$1sslmode=no-verify");
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}sslmode=no-verify`;
}

/** When set to `false` or `0`, skip TLS certificate verification for Postgres (local dev only; e.g. corporate SSL inspection). */
function pgSslOption(): { rejectUnauthorized: false } | undefined {
  if (sslRejectUnauthorizedDisabled()) return { rejectUnauthorized: false };
  return undefined;
}

const connectionString = connectionStringForPool();

/** Single pool per Node/Vercel isolate — avoids exhausting Supabase connection limits. */
const pool =
  globalThis.__pg_pool__ ??
  new Pool({
    connectionString,
    max: Math.min(Number(process.env.DB_POOL_MAX ?? 10), 25),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: pgSslOption(),
  });
globalThis.__pg_pool__ = pool;

const adapter = new PrismaPg(pool);

export const prisma =
  globalThis.__prisma__ ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalThis.__prisma__ = prisma;
