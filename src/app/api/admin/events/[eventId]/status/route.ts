import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import type { EventStatus } from "@/generated/prisma/enums";
import { getRequestActor, isSuperAdmin, resolveActorUserId } from "@/lib/server/auth";
import { moderateConferenceByStatus } from "@/lib/server/admin-conference-moderation";
import { MARKETPLACE_CACHE_TAG } from "@/lib/server/marketplace-queries";

const ALLOWED: EventStatus[] = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED", "CANCELLED"];

export async function PATCH(
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

  const body = (await request.json().catch(() => ({}))) as { status?: unknown; note?: unknown };
  const raw = body.status;
  if (typeof raw !== "string" || !ALLOWED.includes(raw as EventStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED.join(", ")}.` },
      { status: 400 }
    );
  }
  const status = raw as EventStatus;
  const note = typeof body.note === "string" ? body.note : undefined;

  try {
    const result = await moderateConferenceByStatus({
      eventId,
      status,
      note,
      actorUserId,
      actorEmail: actor!.email,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (status === "PUBLISHED") {
      revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
    }

    return NextResponse.json({ ok: true, eventId: result.eventId, status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status update failed.";
    const httpStatus = message === "Event not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status: httpStatus });
  }
}
