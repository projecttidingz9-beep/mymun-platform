import type { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { signSessionToken, type SessionRole } from "@/lib/server/session-token";
import { prismaUserRoleToSession } from "@/lib/server/user-role";

export type OAuthBridgeInput = {
  email: string;
  name: string;
  emailVerified: boolean;
  requestedRole: "delegate" | "organizer" | null;
};

export type OAuthBridgeSuccess = {
  kind: "success";
  user: { id: string; email: string; name: string; role: SessionRole };
  sessionToken: string;
};

export type OAuthBridgeNeedsRole = {
  kind: "needs_role";
  email: string;
  name: string;
};

export type OAuthBridgeError = {
  kind: "error";
  message: string;
  status: number;
};

export type OAuthBridgeResult = OAuthBridgeSuccess | OAuthBridgeNeedsRole | OAuthBridgeError;

/**
 * Shared OAuth → Prisma user + app session token (same rules as legacy Google id_token route).
 */
export async function bridgeOAuthSignIn(input: OAuthBridgeInput): Promise<OAuthBridgeResult> {
  const email = input.email.trim().toLowerCase();
  const name =
    input.name.trim() || (email.includes("@") ? email.split("@")[0] : "User") || "User";

  if (!email.includes("@")) {
    return { kind: "error", message: "Invalid email.", status: 400 };
  }
  if (!input.emailVerified) {
    return { kind: "error", message: "Email must be verified.", status: 400 };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });
  const isFirstLogin = !existing;
  if (isFirstLogin && !input.requestedRole) {
    return { kind: "needs_role", email, name };
  }

  const roleToPersist = existing
    ? existing.role
    : input.requestedRole === "organizer"
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
  const sessionToken = await signSessionToken({
    email: user.email,
    role,
    name: user.name,
    sub: user.id,
    sv: user.sessionVersion,
  });

  return {
    kind: "success",
    user: { id: user.id, email: user.email, name: user.name, role },
    sessionToken,
  };
}

export function setMymunSessionCookie(response: NextResponse, sessionToken: string) {
  response.cookies.set("mymun_session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Short-lived hint before Supabase OAuth redirect (register = role chosen; sign-in may omit). */
export const OAUTH_ROLE_INTENT_COOKIE = "oauth_role_intent";
