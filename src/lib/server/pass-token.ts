import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

export type PassClaims = {
  passId: string;
  registrationId: string;
  eventId: string;
  nonce: string;
};

function getSecret() {
  return new TextEncoder().encode(env.passQrSecret());
}

/** Signs a deterministic pass JWT (no iat) so /api/passes/me can reproduce the same token. */
export async function signPassToken(claims: PassClaims, expiresAt?: Date) {
  const builder = new SignJWT(claims as Record<string, unknown>).setProtectedHeader({
    alg: "HS256",
  });
  if (expiresAt) {
    builder.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
  }
  return builder.sign(getSecret());
}

export async function verifyPassToken(token: string) {
  const verified = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  return verified.payload as PassClaims & { exp?: number };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Pass QR valid through event end + 7 days (gate buffer). */
export function passTokenExpiresAt(eventEndDate: Date): Date {
  const exp = new Date(eventEndDate);
  exp.setDate(exp.getDate() + 7);
  return exp;
}
