import { SignJWT, jwtVerify } from "jose";

export type SessionRole = "delegate" | "organizer" | "admin";

type SessionClaims = {
  email: string;
  role: SessionRole;
  name?: string;
};

const DEFAULT_SECRET = "change-me-session-secret";

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SESSION_SECRET || DEFAULT_SECRET);
}

export async function signSessionToken(claims: SessionClaims) {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const verified = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  const payload = verified.payload as SessionClaims;
  if (!payload.email || !payload.role) return null;
  return payload;
}
