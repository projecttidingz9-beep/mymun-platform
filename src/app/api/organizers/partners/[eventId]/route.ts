import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
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

  try {
    const partnerships = await listEventPartnerships(eventId);
    return NextResponse.json({ partnerships });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list partnerships.";
    return NextResponse.json({ error: message }, { status: 400 });
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
    const message = error instanceof Error ? error.message : "Failed to invite partner.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
