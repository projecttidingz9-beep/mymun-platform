import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

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
      type: notification.type,
      read: notification.read,
      createdAt: notification.createdAt.toISOString(),
      eventId: notification.eventId,
      registrationId: notification.registrationId,
    })),
  });
}
