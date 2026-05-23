import type { NextRequest } from "next/server";

/** Prefer NEXT_PUBLIC_APP_URL so emailed links match the public site (proxies, custom domains). */
export function resolvePublicOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
  if (fromEnv) {
    try {
      const parsed = new URL(fromEnv);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // Fall through to request-derived origin when env is malformed.
    }
  }
  return request.nextUrl.origin;
}
