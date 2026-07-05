import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@/generated/prisma/client";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { organizerNotificationBodySchema } from "@/lib/server/validators/registration";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = organizerNotificationBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;

    const registrationId = body.registrationId;

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
  } catch (error) {
    logger.error("organizer_notification_create_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not create notification." }, { status: 500 });
  }
}
