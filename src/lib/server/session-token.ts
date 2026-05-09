import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

export type SessionRole = "delegate" | "organizer" | "admin";

export type SessionClaims = {
  email: string;
  role: SessionRole;
  name?: string;
  /** JWT `sub` — user id */
  sub?: string;
  /** Issued session version; must match User.sessionVersion (sign-out everywhere). */
  sv?: number;
};

function getSecret() {
  return new TextEncoder().encode(env.authSessionSecret());
}

export async function signSessionToken(
  claims: SessionClaims & { sub: string; sv: number }
) {
  const { sub, sv, ...rest } = claims;
  return await new SignJWT({ ...rest, sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const verified = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  const payload = verified.payload as SessionClaims & { sub?: string };
  if (!payload.email || !payload.role) return null;
  return payload as SessionClaims & { sub?: string };
}
