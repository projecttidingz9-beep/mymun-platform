import { NextRequest, NextResponse } from "next/server";
import { DelegationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ delegationId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const delegationId = String(params.delegationId || "").trim();
  if (!delegationId) {
    return NextResponse.json({ error: "delegationId is required." }, { status: 400 });
  }

  const delegation = await prisma.delegation.findUnique({
    where: { id: delegationId },
    select: { id: true, eventId: true },
  });
  if (!delegation) {
    return NextResponse.json({ error: "Delegation not found." }, { status: 404 });
  }

  if (!(await requireEventOrganizerAccess(actor, delegation.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : undefined;
  const status =
    statusRaw === "CLOSED"
      ? DelegationStatus.CLOSED
      : statusRaw === "OPEN"
        ? DelegationStatus.OPEN
        : undefined;

  const schoolName =
    typeof body.schoolName === "string" ? body.schoolName.trim() || null : undefined;
  const name = typeof body.name === "string" ? body.name.trim() || null : undefined;

  const maxMembersRaw = body.maxMembers;
  let maxMembers: number | null | undefined;
  if (maxMembersRaw === null) {
    maxMembers = null;
  } else if (maxMembersRaw !== undefined) {
    const parsed = Number(maxMembersRaw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json({ error: "maxMembers must be a positive number." }, { status: 400 });
    }
    maxMembers = parsed;
  }

  const updated = await prisma.delegation.update({
    where: { id: delegationId },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(schoolName !== undefined ? { schoolName } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(maxMembers !== undefined ? { maxMembers } : {}),
    },
    select: {
      id: true,
      eventId: true,
      schoolName: true,
      name: true,
      status: true,
      maxMembers: true,
    },
  });

  return NextResponse.json({ ok: true, delegation: updated });
}
