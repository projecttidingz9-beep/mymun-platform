import { NextRequest, NextResponse } from "next/server";
import { NotificationType, PositionPaperStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "").trim();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, deletedAt: null },
    select: { id: true, eventId: true, userId: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const committeeId = String(body.committeeId || "").trim();
  const statusRaw = String(body.status || "").trim().toUpperCase();
  const reviewerNotes =
    typeof body.reviewerNotes === "string" ? body.reviewerNotes.trim() || null : undefined;

  if (!committeeId) {
    return NextResponse.json({ error: "committeeId is required." }, { status: 400 });
  }

  const status =
    statusRaw === "APPROVED"
      ? PositionPaperStatus.APPROVED
      : statusRaw === "REJECTED"
        ? PositionPaperStatus.REJECTED
        : statusRaw === "PENDING"
          ? PositionPaperStatus.PENDING
          : undefined;

  if (!status) {
    return NextResponse.json(
      { error: "status must be APPROVED, REJECTED, or PENDING." },
      { status: 400 }
    );
  }

  const existing = await prisma.positionPaper.findUnique({
    where: { registrationId_committeeId: { registrationId, committeeId } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Position paper not found." }, { status: 404 });
  }

  const paper = await prisma.positionPaper.update({
    where: { id: existing.id },
    data: {
      status,
      ...(reviewerNotes !== undefined ? { reviewerNotes } : {}),
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      reviewerNotes: true,
      reviewedAt: true,
    },
  });

  const statusLabel =
    status === PositionPaperStatus.APPROVED
      ? "approved"
      : status === PositionPaperStatus.REJECTED
        ? "needs revision"
        : "pending review";

  await prisma.notification.create({
    data: {
      userId: registration.userId,
      eventId: registration.eventId,
      registrationId,
      title: "Position paper update",
      message: `Your position paper has been ${statusLabel}.${reviewerNotes ? ` Notes: ${reviewerNotes}` : ""}`,
      type: NotificationType.APP_STATUS,
    },
  });

  return NextResponse.json({ ok: true, positionPaper: paper });
}
