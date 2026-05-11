import type { NextRequest } from "next/server";

/** Prefer NEXT_PUBLIC_APP_URL so emailed links match the public site (proxies, custom domains). */
export function resolvePublicOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
  if (fromEnv) return fromEnv;
  return request.nextUrl.origin;
}
