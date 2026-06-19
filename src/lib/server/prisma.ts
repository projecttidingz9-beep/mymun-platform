import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { Pool } from "pg";
import { env } from "./env";

declare global {
  var __prisma__: PrismaClient | undefined;
  var __pg_pool__: Pool | undefined;
  var __prisma_session__: PrismaClient | undefined;
  var __pg_session_pool__: Pool | undefined;
}

function sslRejectUnauthorizedDisabled(): boolean {
  const v = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  return v === "false" || v === "0";
}

/**
 * Pooled URL for runtime queries. When dev TLS bypass is enabled, rewrite sslmode:
 * pg v8+ treats `sslmode=require` as verify-full and ignores `rejectUnauthorized: false`.
 */
function normalizeConnectionString(rawUrl: string, options?: { stripPgBouncer?: boolean }): string {
  let url = rawUrl;
  if (options?.stripPgBouncer) {
    url = url
      .replace(/([?&])pgbouncer=true&?/gi, "$1")
      .replace(/[?&]$/, "");
  }
  if (sslRejectUnauthorizedDisabled()) {
    if (/[?&]sslmode=/i.test(url)) {
      return url.replace(/([?&])sslmode=[^&]*/i, "$1sslmode=no-verify");
    }
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}sslmode=no-verify`;
  }
  if (/sslmode=require/i.test(url) && !/uselibpqcompat=/i.test(url)) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}uselibpqcompat=true`;
  }
  return url;
}

/** When set to `false` or `0`, skip TLS certificate verification for Postgres (local dev only; e.g. corporate SSL inspection). */
function pgSslOption(
  url: string
): boolean | { rejectUnauthorized: boolean } | undefined {
  if (sslRejectUnauthorizedDisabled()) return { rejectUnauthorized: false };
  if (/sslmode=require|sslmode=verify-full/i.test(url)) {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

function createPool(connectionString: string, max: number): Pool {
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: pgSslOption(connectionString),
  });
}

function createPrismaClient(pool: Pool): PrismaClient {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const connectionString = normalizeConnectionString(env.databaseUrl());

/** Single pool per Node/Vercel isolate — avoids exhausting Supabase connection limits. */
const pool =
  globalThis.__pg_pool__ ??
  createPool(connectionString, Math.min(Number(process.env.DB_POOL_MAX ?? 10), 25));
globalThis.__pg_pool__ = pool;

export const prisma = globalThis.__prisma__ ?? createPrismaClient(pool);
globalThis.__prisma__ = prisma;

/** Session pooler / direct URL — required for interactive Prisma transactions on Supabase. */
const sessionConnectionString = normalizeConnectionString(env.directDatabaseUrl(), {
  stripPgBouncer: true,
});

const sessionPool =
  globalThis.__pg_session_pool__ ??
  createPool(
    sessionConnectionString,
    Math.min(Number(process.env.DB_SESSION_POOL_MAX ?? 3), 10)
  );
globalThis.__pg_session_pool__ = sessionPool;

export const prismaSession =
  globalThis.__prisma_session__ ?? createPrismaClient(sessionPool);
globalThis.__prisma_session__ = prismaSession;

export type PrismaTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

/** Run an interactive transaction on the session pool (not the transaction pooler). */
export function runPrismaTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: PrismaTransactionOptions
): Promise<T> {
  return prismaSession.$transaction(fn, options);
}
