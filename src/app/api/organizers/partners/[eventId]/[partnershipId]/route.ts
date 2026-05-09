import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
import { unlinkPartnership, updatePartnershipStatus } from "@/lib/server/organizer-partners";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; partnershipId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }
  const actorUserId = await resolveActorUserId(actor);
  if (!actorUserId) {
    return NextResponse.json({ error: "Unable to resolve user." }, { status: 401 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "");
  const partnershipId = String(params.partnershipId || "");
  if (!eventId || !partnershipId) {
    return NextResponse.json({ error: "eventId and partnershipId are required." }, { status: 400 });
  }
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "").toLowerCase();
  const statusMap = {
    accept: "ACCEPTED",
    reject: "REJECTED",
    cancel: "CANCELLED",
  } as const;
  const nextStatus = statusMap[action as keyof typeof statusMap];
  if (!nextStatus) {
    return NextResponse.json({ error: "Invalid action. Use accept, reject, or cancel." }, { status: 400 });
  }

  try {
    const partnership = await updatePartnershipStatus({
      eventId,
      partnershipId,
      actorUserId,
      nextStatus,
    });
    return NextResponse.json({ partnership });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update partnership.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; partnershipId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }
  const actorUserId = await resolveActorUserId(actor);
  if (!actorUserId) {
    return NextResponse.json({ error: "Unable to resolve user." }, { status: 401 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "");
  const partnershipId = String(params.partnershipId || "");
  if (!eventId || !partnershipId) {
    return NextResponse.json({ error: "eventId and partnershipId are required." }, { status: 400 });
  }
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  try {
    await unlinkPartnership({ eventId, partnershipId, actorUserId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unlink partnership.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
