import { NextRequest, NextResponse } from "next/server";
import type { OrganizerConference } from "@/lib/types";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { persistOrganizerConferenceSync } from "@/lib/server/persist-organizer-conference-sync";
import { mapManagedEventToOrganizerConference } from "@/lib/server/map-managed-event-to-organizer-conference";

export async function PUT(
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

  const body = (await request.json().catch(() => ({}))) as { conference?: OrganizerConference };
  if (!body.conference || typeof body.conference !== "object") {
    return NextResponse.json({ error: "conference payload required." }, { status: 400 });
  }

  try {
    await persistOrganizerConferenceSync(eventId, body.conference);
    const conference = await mapManagedEventToOrganizerConference(eventId);
    return NextResponse.json({ conference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
