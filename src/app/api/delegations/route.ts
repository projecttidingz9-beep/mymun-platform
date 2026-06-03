import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ownerUserId = await resolveActorUserId(actor);
  if (!ownerUserId) {
    return NextResponse.json({ error: "User profile not found. Sign in again." }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const eventId = String(body.eventId || "").trim();
    const schoolName = String(body.schoolName || "").trim();
    const maxMembersRaw = body.maxMembers;
    const registrationId =
      typeof body.registrationId === "string" ? body.registrationId.trim() : undefined;

    if (!eventId || !schoolName) {
      return NextResponse.json({ error: "eventId and schoolName are required." }, { status: 400 });
    }

    const maxMembers =
      maxMembersRaw === undefined || maxMembersRaw === null
        ? null
        : Number(maxMembersRaw);
    if (maxMembers !== null && (!Number.isFinite(maxMembers) || maxMembers < 1)) {
      return NextResponse.json({ error: "maxMembers must be a positive number." }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Conference not found." }, { status: 404 });
    }

    if (registrationId) {
      const registration = await prisma.registration.findFirst({
        where: { id: registrationId, userId: ownerUserId, eventId, deletedAt: null },
        select: { id: true, delegationId: true },
      });
      if (!registration) {
        return NextResponse.json(
          { error: "Registration not found or does not belong to you for this conference." },
          { status: 404 }
        );
      }
      if (registration.delegationId) {
        return NextResponse.json(
          { error: "Registration is already linked to a delegation." },
          { status: 409 }
        );
      }
    }

    const inviteToken = randomUUID();

    const delegation = await prisma.$transaction(async (tx) => {
      const created = await tx.delegation.create({
        data: {
          eventId,
          inviteToken,
          schoolName,
          name: schoolName,
          maxMembers,
          ownerUserId,
        },
        select: {
          id: true,
          inviteToken: true,
          schoolName: true,
          maxMembers: true,
          status: true,
          createdAt: true,
        },
      });

      if (registrationId) {
        await tx.registration.update({
          where: { id: registrationId },
          data: { delegationId: created.id, isDelegationHead: true },
        });
      }

      return created;
    });

    return NextResponse.json({ ok: true, delegation });
  } catch {
    return NextResponse.json({ error: "Failed to create delegation." }, { status: 500 });
  }
}
