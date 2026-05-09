import { NextRequest, NextResponse } from "next/server";
import { validateSessionToken } from "@/lib/server/auth";

const protectedApiPatterns = [
  /^\/api\/passes\//,
  /^\/api\/checkins$/,
  /^\/api\/registrations$/,
  /^\/api\/registrations\/sync$/,
  /^\/api\/notifications\/me$/,
  /^\/api\/notifications\/stream$/,
  /^\/api\/organizers\//,
  /^\/api\/user\//,
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

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = protectedApiPatterns.some((pattern) => pattern.test(path));
  if (!isProtected) return NextResponse.next();

  const bearer = request.headers.get("authorization");
  const bearerToken = bearer?.startsWith("Bearer ")
    ? bearer.slice("Bearer ".length).trim()
    : null;
  const cookieToken = request.cookies.get("mymun_session")?.value;
  const token = bearerToken || cookieToken;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = await validateSessionToken(token);
  if (!actor) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
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
  ],
};
