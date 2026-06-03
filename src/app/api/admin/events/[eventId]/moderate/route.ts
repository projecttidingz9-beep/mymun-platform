import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getRequestActor, isSuperAdmin, resolveActorUserId } from "@/lib/server/auth";
import {
  moderateConference,
  type ModerationAction,
} from "@/lib/server/admin-conference-moderation";
import { MARKETPLACE_CACHE_TAG } from "@/lib/server/marketplace-queries";

export async function POST(
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

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    note?: unknown;
  };

  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject".' },
      { status: 400 }
    );
  }

  const note = typeof body.note === "string" ? body.note : undefined;

  try {
    const result = await moderateConference({
      eventId,
      action: action as ModerationAction,
      note,
      actorUserId,
      actorEmail: actor!.email,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (action === "approve") {
      revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Moderation failed.";
    const status = message === "Event not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
