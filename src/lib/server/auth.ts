import { NextRequest } from "next/server";
import { SessionRole, verifySessionToken } from "./session-token";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "./prisma";

export type RequestActor = {
  email: string;
  role: SessionRole;
  name?: string;
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
  return { email: payload.email, role: payload.role, name: payload.name };
}

export function requireOrganizer(actor: RequestActor | null) {
  return actor?.role === "organizer" || actor?.role === "admin";
}

export async function resolveActorUserId(actor: RequestActor | null): Promise<string | null> {
  if (!actor) return null;
  const role =
    actor.role === "admin"
      ? UserRole.ADMIN
      : actor.role === "organizer"
        ? UserRole.ORGANIZER
        : UserRole.DELEGATE;
  const fallbackName = actor.email.split("@")[0] || "Organizer";
  const user = await prisma.user.upsert({
    where: { email: actor.email },
    update: {
      name: actor.name || fallbackName,
      role,
    },
    create: {
      email: actor.email,
      name: actor.name || fallbackName,
      role,
    },
    select: { id: true },
  });
  return user.id;
}
