import { NextRequest, NextResponse } from "next/server";
import type { NotificationType } from "@/generated/prisma/client";
import type { UserNotification } from "@/lib/types";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

function mapNotificationType(t: NotificationType): UserNotification["type"] {
  if (t === "PASS_RELEASED" || t === "PAYMENT_CONFIRMED") return "status";
  if (t === "CHECKED_IN") return "status";
  if (t === "TEAM_INVITE" || t === "ANNOUNCEMENT") return "status";
  if (t === "APP_STATUS") return "assignment";
  return "status";
}

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
  });
  if (!user) return NextResponse.json({ notifications: [] });

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: mapNotificationType(notification.type),
      read: notification.read,
      createdAt: notification.createdAt.toISOString(),
      conferenceId: notification.eventId,
      eventId: notification.eventId,
      registrationId: notification.registrationId,
      userId: notification.userId,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: string; read?: boolean };
  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const read = body.read !== false;

  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
