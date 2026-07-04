import { NextRequest } from "next/server";
import { SessionRole, verifySessionToken } from "./session-token";
import { env } from "./env";
import { prisma } from "./prisma";
import { getOrganizerPreviewConfig } from "./organizer-config-store";
import { prismaUserRoleToSession } from "./user-role";
import { matchesLegacyOwnerOrTeam } from "./event-ownership";

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

  return validateSessionToken(token);
}

export function requireOrganizer(actor: RequestActor | null) {
  return actor?.role === "organizer" || actor?.role === "admin";
}

const normalizeEmail = (value: string | undefined | null) => (value || "").trim().toLowerCase();

/** Super-admin: `ADMIN` role in DB and email matches `ADMIN_EMAIL` (env). */
export function isSuperAdmin(actor: RequestActor | null): boolean {
  if (!actor || actor.role !== "admin") return false;
  return normalizeEmail(actor.email) === env.adminEmail();
}

/**
 * Verifies the JWT and enforces `User.sessionVersion` (revoked sessions) and account lock.
 */
export async function validateSessionToken(token: string): Promise<RequestActor | null> {
  const payload = await verifySessionToken(token).catch(() => null);
  if (!payload?.email || !payload.role) return null;
  const email = normalizeEmail(payload.email);
  const sub = typeof payload.sub === "string" ? payload.sub : undefined;
  const svClaim = typeof payload.sv === "number" ? payload.sv : undefined;

  const user = sub
    ? await prisma.user.findFirst({
        where: { id: sub, email },
        select: {
          id: true,
          role: true,
          sessionVersion: true,
          deletedAt: true,
          lockedUntil: true,
        },
      })
    : await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          role: true,
          sessionVersion: true,
          deletedAt: true,
          lockedUntil: true,
        },
      });

  if (!user || user.deletedAt) return null;
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;
  const effectiveSv = svClaim ?? 0;
  if (effectiveSv !== user.sessionVersion) return null;

  return {
    email,
    role: prismaUserRoleToSession(user.role),
    name: payload.name,
  };
}

export async function requireEventOrganizerAccess(
  actor: RequestActor | null,
  eventId: string
): Promise<boolean> {
  if (!requireOrganizer(actor)) return false;
  if (actor?.role === "admin") return true;
  const actorUserId = await resolveActorUserId(actor);
  const actorEmail = normalizeEmail(actor?.email);
  if (!actorUserId && !actorEmail) return false;

  const teamMember = actorUserId
    ? await prisma.eventTeamMember.findFirst({
        where: {
          eventId,
          userId: actorUserId,
          acceptedAt: { not: null },
        },
      })
    : null;
  if (teamMember) return true;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerUserId: true },
  });
  if (actorUserId && event?.ownerUserId && event.ownerUserId === actorUserId) return true;

  const dbTeamCount = await prisma.eventTeamMember.count({
    where: { eventId, acceptedAt: { not: null } },
  });
  if (dbTeamCount > 0) {
    return false;
  }

  const config = await getOrganizerPreviewConfig(eventId);
  return matchesLegacyOwnerOrTeam(config, actorUserId, actor?.email ?? null);
}

/** Resolve DB user id from session — read-only (no upsert). Login/register/google create the row first. */
export async function resolveActorUserId(actor: RequestActor | null): Promise<string | null> {
  if (!actor) return null;
  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true },
  });
  return user?.id ?? null;
}
