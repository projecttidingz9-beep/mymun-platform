import { prisma } from "./prisma";

/**
 * Fixed-window rate limiter backed by Postgres (works across server instances).
 * Returns `true` if the request is allowed, `false` if the limit is exceeded.
 */
export async function consumeRateLimitBucket(params: {
  key: string;
  windowMs: number;
  limit: number;
}): Promise<boolean> {
  const { key, windowMs, limit } = params;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const updated = await prisma.rateLimitBucket.upsert({
    where: {
      key_windowStart: { key, windowStart },
    },
    create: {
      key,
      windowStart,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
  });

  return updated.count <= limit;
}
