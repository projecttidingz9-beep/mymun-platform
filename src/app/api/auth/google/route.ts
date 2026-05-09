import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/server/prisma";
import { signSessionToken } from "@/lib/server/session-token";
import { prismaUserRoleToSession } from "@/lib/server/user-role";

type GoogleClaims = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub?: string;
  aud?: string | string[];
};

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const idToken = String(body.idToken || "");
    const requestedRole = body.role === "organizer" || body.role === "delegate" ? body.role : null;
    const configuredClientId =
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

    if (!configuredClientId) {
      return NextResponse.json({ error: "Google Sign-In is not configured." }, { status: 503 });
    }
    if (!idToken) {
      return NextResponse.json({ error: "Google credential is required." }, { status: 400 });
    }

    const verified = await jwtVerify(idToken, GOOGLE_JWKS, {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: configuredClientId,
    });
    const claims = verified.payload as GoogleClaims;
    const email = String(claims.email || "").trim().toLowerCase();
    const name = String(claims.name || email.split("@")[0] || "User").trim();
    const picture = typeof claims.picture === "string" ? claims.picture : undefined;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Google account email is unavailable." }, { status: 400 });
    }
    if (!claims.email_verified) {
      return NextResponse.json({ error: "Google email must be verified." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });
    const isFirstLogin = !existing;
    if (isFirstLogin && !requestedRole) {
      return NextResponse.json({
        ok: false,
        requiresRole: true,
        email,
        name,
        picture,
      });
    }

    const roleToPersist = existing
      ? existing.role
      : requestedRole === "organizer"
        ? "ORGANIZER"
        : "DELEGATE";
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: roleToPersist,
      },
      create: {
        email,
        name,
        role: roleToPersist,
      },
      select: { id: true, email: true, name: true, role: true, sessionVersion: true },
    });

    const role = prismaUserRoleToSession(user.role);
    const token = await signSessionToken({
      email: user.email,
      role,
      name: user.name,
      sub: user.id,
      sv: user.sessionVersion,
    });
    const response = NextResponse.json({
      ok: true,
      id: user.id,
      email: user.email,
      name: user.name,
      role,
    });
    response.cookies.set("mymun_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Google sign-in failed." }, { status: 400 });
  }
}

