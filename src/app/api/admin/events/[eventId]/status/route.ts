import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EventStatus } from "@/generated/prisma/enums";
import { getRequestActor, isSuperAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const ALLOWED: EventStatus[] = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED", "CANCELLED"];

export async function PATCH(
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

  const body = (await request.json().catch(() => ({}))) as { status?: unknown };
  const raw = body.status;
  if (typeof raw !== "string" || !ALLOWED.includes(raw as EventStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED.join(", ")}.` },
      { status: 400 }
    );
  }
  const status = raw as EventStatus;

  const existing = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { status },
  });

  return NextResponse.json({ ok: true, eventId, status });
}
