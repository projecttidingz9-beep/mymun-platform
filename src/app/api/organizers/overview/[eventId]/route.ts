import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer } from "@/lib/server/auth";
import { getOrganizerOverviewAnalytics } from "@/lib/server/organizer-overview";

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

  const analytics = await getOrganizerOverviewAnalytics(eventId);
  return NextResponse.json({ analytics });
}
