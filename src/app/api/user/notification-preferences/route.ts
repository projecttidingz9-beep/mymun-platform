import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { NotificationType } from "@/generated/prisma/client";

const TYPES = Object.values(NotificationType).filter(
  (v): v is NotificationType => typeof v === "string"
);

/** GET current preferences (defaults created lazily for missing rows). */
export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const existing = await prisma.userNotificationPreference.findMany({
    where: { userId: user.id },
  });

  const map = new Map(existing.map((p) => [p.notificationType, p]));
  const preferences = TYPES.map((type) => {
    const pref = map.get(type);
    return {
      notificationType: type,
      emailEnabled: pref?.emailEnabled ?? true,
      inAppEnabled: pref?.inAppEnabled ?? true,
    };
  });

  return NextResponse.json({ preferences });
}

/** PATCH — body: { preferences: Array<{ notificationType, emailEnabled?, inAppEnabled? }> } */
export async function PATCH(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    preferences?: Array<{
      notificationType: NotificationType;
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
    }>;
  } | null;

  if (!body?.preferences?.length) {
    return NextResponse.json({ error: "preferences array required." }, { status: 400 });
  }

  for (const pref of body.preferences) {
    if (!TYPES.includes(pref.notificationType)) continue;
    await prisma.userNotificationPreference.upsert({
      where: {
        userId_notificationType: {
          userId: user.id,
          notificationType: pref.notificationType,
        },
      },
      create: {
        userId: user.id,
        notificationType: pref.notificationType,
        emailEnabled: pref.emailEnabled ?? true,
        inAppEnabled: pref.inAppEnabled ?? true,
      },
      update: {
        ...(typeof pref.emailEnabled === "boolean" ? { emailEnabled: pref.emailEnabled } : {}),
        ...(typeof pref.inAppEnabled === "boolean" ? { inAppEnabled: pref.inAppEnabled } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
