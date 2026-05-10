import { NextResponse } from "next/server";

/**
 * Edge middleware — extra headers on top of `next.config.ts`.
 * Vercel terminates TLS; add HSTS only in production.
 */
export function middleware() {
  const res = NextResponse.next();
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next internals and common static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon|robots.txt|sitemap.xml).*)",
  ],
};
