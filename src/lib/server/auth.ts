import { NextRequest } from "next/server";
import { SessionRole, verifySessionToken } from "./session-token";

export type RequestActor = {
  email: string;
  role: SessionRole;
};

export async function getRequestActor(request: NextRequest): Promise<RequestActor | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const cookieToken = request.cookies.get("mymun_session")?.value;
  const token = bearerToken || cookieToken;
  if (!token) return null;

  const payload = await verifySessionToken(token).catch(() => null);
  if (!payload) return null;
  return { email: payload.email, role: payload.role };
}

export function requireOrganizer(actor: RequestActor | null) {
  return actor?.role === "organizer" || actor?.role === "admin";
}
