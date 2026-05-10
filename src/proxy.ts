import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { verifySessionToken, type SessionClaims } from "@/lib/server/session-token";

const protectedApiPatterns = [
  /^\/api\/passes\//,
  /^\/api\/checkins$/,
  /^\/api\/registrations$/,
  /^\/api\/registrations\/sync$/,
  /^\/api\/notifications\/me$/,
  /^\/api\/notifications\/stream$/,
  /^\/api\/organizers\//,
  /^\/api\/user\//,
  /^\/api\/admin\//,
];

const organizerOnlyPatterns = [
  /^\/api\/passes\/issue$/,
  /^\/api\/passes\/verify$/,
  /^\/api\/checkins$/,
  /^\/api\/registrations\/sync$/,
  /^\/api\/organizers\//,
];

const delegateOnlyPatterns = [
  /^\/api\/passes\/me$/,
  /^\/api\/notifications\/me$/,
  /^\/api\/registrations$/,
];

const adminOnlyPatterns = [/^\/api\/admin\//];

function normalizeEmail(value: string | undefined | null) {
  return (value || "").trim().toLowerCase();
}

function actorFromPayload(payload: SessionClaims & { sub?: string }) {
  return {
    email: normalizeEmail(payload.email),
    role: payload.role,
    name: payload.name,
  };
}

/**
 * Middleware gate using JWT verification only (Edge-safe).
 * Route handlers still use `validateSessionToken` + DB for session version / locks.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  if (isAdminPage && !path.startsWith("/api")) {
    const bearer = request.headers.get("authorization");
    const bearerToken = bearer?.startsWith("Bearer ") ? bearer.slice("Bearer ".length).trim() : null;
    const cookieToken = request.cookies.get("mymun_session")?.value;
    const token = bearerToken || cookieToken;
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const payload = await verifySessionToken(token).catch(() => null);
    if (!payload?.email || !payload.role) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const actor = actorFromPayload(payload);
    const adminEmail = env.adminEmail();
    if (actor.role !== "admin" || actor.email !== adminEmail) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const isProtected = protectedApiPatterns.some((pattern) => pattern.test(path));
  if (!isProtected) return NextResponse.next();

  const bearer = request.headers.get("authorization");
  const bearerToken = bearer?.startsWith("Bearer ") ? bearer.slice("Bearer ".length).trim() : null;
  const cookieToken = request.cookies.get("mymun_session")?.value;
  const token = bearerToken || cookieToken;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await verifySessionToken(token).catch(() => null);
  if (!payload?.email || !payload.role) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const actor = actorFromPayload(payload);

  const isAdminOnly = adminOnlyPatterns.some((pattern) => pattern.test(path));
  if (isAdminOnly) {
    const adminEmail = env.adminEmail();
    if (actor.role !== "admin" || actor.email !== adminEmail) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    return NextResponse.next();
  }

  const isOrganizerOnly = organizerOnlyPatterns.some((pattern) => pattern.test(path));
  if (isOrganizerOnly && !["organizer", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const isDelegateOnly = delegateOnlyPatterns.some((pattern) => pattern.test(path));
  if (isDelegateOnly && !["delegate", "organizer", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Delegate access required." }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/passes/:path*",
    "/api/checkins",
    "/api/registrations",
    "/api/registrations/sync",
    "/api/notifications/me",
    "/api/notifications/stream",
    "/api/organizers/:path*",
    "/api/user/:path*",
    "/api/admin/:path*",
    "/admin/:path*",
  ],
};
