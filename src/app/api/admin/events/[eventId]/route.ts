import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestActor, isSuperAdmin } from "@/lib/server/auth";
import { getAdminReviewEventDetail } from "@/lib/server/admin-conference-moderation";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "").trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const detail = await getAdminReviewEventDetail(eventId);
  if (!detail) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
