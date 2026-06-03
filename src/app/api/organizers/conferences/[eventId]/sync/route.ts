import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { OrganizerConference } from "@/lib/types";
import {
  getRequestActor,
  isSuperAdmin,
  requireEventOrganizerAccess,
  requireOrganizer,
} from "@/lib/server/auth";
import {
  formatOrganizerSyncError,
  persistOrganizerConferenceSync,
} from "@/lib/server/persist-organizer-conference-sync";
import { mapManagedEventToOrganizerConference } from "@/lib/server/map-managed-event-to-organizer-conference";
import { MARKETPLACE_CACHE_TAG } from "@/lib/server/marketplace-queries";

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

  const body = (await request.json().catch(() => ({}))) as {
    conference?: OrganizerConference;
    syncStatus?: boolean;
  };
  if (!body.conference || typeof body.conference !== "object") {
    return NextResponse.json({ error: "conference payload required." }, { status: 400 });
  }

  try {
    await persistOrganizerConferenceSync(eventId, body.conference, {
      skipReviewGate: isSuperAdmin(actor),
      syncStatus: body.syncStatus !== false,
    });
    revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
    const conference = await mapManagedEventToOrganizerConference(eventId);
    return NextResponse.json({ conference });
  } catch (error) {
    return NextResponse.json({ error: formatOrganizerSyncError(error) }, { status: 400 });
  }
}
