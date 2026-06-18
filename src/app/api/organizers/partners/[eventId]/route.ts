import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { invitePartnerEvent, listEventPartnerships } from "@/lib/server/organizer-partners";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  try {
    const partnerships = await listEventPartnerships(eventId);
    return NextResponse.json({ partnerships });
  } catch (error) {
    logger.error("partners_list_failed", {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to list partnerships." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
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
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const targetEventId = String(body.targetEventId || "");
  if (!targetEventId) {
    return NextResponse.json({ error: "targetEventId is required." }, { status: 400 });
  }

  try {
    const partnership = await invitePartnerEvent({
      sourceEventId: eventId,
      targetEventId,
      actorUserId,
    });
    return NextResponse.json({ partnership });
  } catch (error) {
    logger.error("partner_invite_failed", {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to invite partner." }, { status: 500 });
  }
}
