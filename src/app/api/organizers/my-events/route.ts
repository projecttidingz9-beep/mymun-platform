import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
import { listManagedEventIds } from "@/lib/server/list-managed-event-ids";
import { mapManagedEventsInBatches } from "@/lib/server/map-managed-events-batch";

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const actorUserId = await resolveActorUserId(actor);
  const ids = await listManagedEventIds(actorUserId, actor?.email ?? null);

  const conferences = await mapManagedEventsInBatches(ids);

  return NextResponse.json({ conferences });
}
