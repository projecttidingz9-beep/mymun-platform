import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@/generated/prisma/client";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    registrationId?: string;
    title?: string;
    message?: string;
    type?: string;
  };

  const registrationId = String(body.registrationId || "").trim();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, deletedAt: null },
    select: { id: true, userId: true, eventId: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const title = String(body.title || "").trim() || "Update";
  const message = String(body.message || "").trim() || "";

  const rawType = String(body.type || "").toUpperCase();
  const type =
    rawType === "WAITLIST"
      ? NotificationType.APP_STATUS
      : rawType === "ASSIGNMENT"
        ? NotificationType.APP_STATUS
        : NotificationType.APP_STATUS;

  await prisma.notification.create({
    data: {
      userId: registration.userId,
      eventId: registration.eventId,
      registrationId: registration.id,
      title,
      message,
      type,
      read: false,
    },
  });

  return NextResponse.json({ ok: true });
}
