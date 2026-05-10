import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
import { listManagedEventIds } from "@/lib/server/list-managed-event-ids";
import { mapManagedEventToOrganizerConference } from "@/lib/server/map-managed-event-to-organizer-conference";

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const actorUserId = await resolveActorUserId(actor);
  const ids = await listManagedEventIds(actorUserId, actor?.email ?? null);

  const conferences = [];
  for (const id of ids) {
    const mapped = await mapManagedEventToOrganizerConference(id);
    if (mapped) conferences.push(mapped);
  }

  return NextResponse.json({ conferences });
}
