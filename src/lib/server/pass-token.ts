import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

type PassClaims = {
  passId: string;
  registrationId: string;
  eventId: string;
};

function getSecret() {
  return new TextEncoder().encode(env.passQrSecret());
}

export async function signPassToken(claims: PassClaims) {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15d")
    .sign(getSecret());
}

export async function verifyPassToken(token: string) {
  const verified = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  return verified.payload as PassClaims & { iat?: number; exp?: number };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
