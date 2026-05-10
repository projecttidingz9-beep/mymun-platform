import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  bridgeOAuthSignIn,
  setMymunSessionCookie,
} from "@/lib/server/oauth-bridge";

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
    const requestedRole: "delegate" | "organizer" | null =
      body.role === "organizer" ? "organizer" : body.role === "delegate" ? "delegate" : null;
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

    const bridge = await bridgeOAuthSignIn({
      email,
      name,
      emailVerified: Boolean(claims.email_verified),
      requestedRole,
    });

    if (bridge.kind === "needs_role") {
      return NextResponse.json({
        ok: false,
        requiresRole: true,
        email: bridge.email,
        name: bridge.name,
        picture,
      });
    }
    if (bridge.kind === "error") {
      return NextResponse.json({ error: bridge.message }, { status: bridge.status });
    }

    const response = NextResponse.json({
      ok: true,
      id: bridge.user.id,
      email: bridge.user.email,
      name: bridge.user.name,
      role: bridge.user.role,
    });
    setMymunSessionCookie(response, bridge.sessionToken);
    return response;
  } catch {
    return NextResponse.json({ error: "Google sign-in failed." }, { status: 400 });
  }
}

