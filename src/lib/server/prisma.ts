import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { env } from "./env";

declare global {
  var __prisma__: PrismaClient | undefined;
  var __pg_pool__: Pool | undefined;
}

const connectionString = env.databaseUrl();

/** Single pool per Node/Vercel isolate — avoids exhausting Supabase connection limits. */
const pool =
  globalThis.__pg_pool__ ??
  new Pool({
    connectionString,
    max: Math.min(Number(process.env.DB_POOL_MAX ?? 10), 25),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
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
