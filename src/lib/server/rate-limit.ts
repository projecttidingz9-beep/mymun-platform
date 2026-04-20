const bucket = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const current = bucket.get(key);

  if (!current || now > current.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (current.count >= maxRequests) {
    return true;
  }

  current.count += 1;
  bucket.set(key, current);
  return false;
}
