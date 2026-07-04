import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
import { listManagedEventIds } from "@/lib/server/list-managed-event-ids";
import { prisma } from "@/lib/server/prisma";

/**
 * An organizer account cannot be deleted (self-service or otherwise) while it still manages any
 * conference that hasn't reached a terminal state — Draft/Review/Published/Suspended all still
 * carry live data, pending applications, or payout obligations. Only Archived/Cancelled (or no
 * conferences at all) are considered "no active MUN".
 */
export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const actorUserId = await resolveActorUserId(actor);
  const ids = await listManagedEventIds(actorUserId, actor?.email ?? null);

  if (ids.length === 0) {
    return NextResponse.json({ eligible: true, activeConferenceCount: 0 });
  }

  const activeCount = await prisma.event.count({
    where: {
      id: { in: ids },
      deletedAt: null,
      status: { in: ["DRAFT", "REVIEW", "PUBLISHED", "SUSPENDED"] },
    },
  });

  return NextResponse.json({ eligible: activeCount === 0, activeConferenceCount: activeCount });
}
