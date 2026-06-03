import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestActor, isSuperAdmin, resolveActorUserId } from "@/lib/server/auth";
import {
  deleteConferenceAsAdmin,
  getAdminReviewEventDetail,
} from "@/lib/server/admin-conference-moderation";

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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const actorUserId = await resolveActorUserId(actor);
  if (!actorUserId) {
    return NextResponse.json({ error: "Admin user not found." }, { status: 400 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "").trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const result = await deleteConferenceAsAdmin({
      eventId,
      actorUserId,
      actorEmail: actor!.email,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed.";
    const status = message === "Event not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
