import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { hashToken, verifyPassToken } from "@/lib/server/pass-token";
import { isRateLimited } from "@/lib/server/rate-limit";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  const rateKey = `${actor?.email || "unknown"}:checkin`;
  if (isRateLimited(rateKey, 120, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const qrToken = String(body.qrToken || "");
    if (!qrToken) {
      return NextResponse.json({ error: "QR token is required." }, { status: 400 });
    }

    const payload = await verifyPassToken(qrToken);
    const tokenHash = hashToken(qrToken);
    const pass = await prisma.delegatePass.findUnique({
      where: { id: payload.passId },
      include: {
        registration: {
          include: { user: true, event: true },
        },
      },
    });

    if (!pass || pass.qrTokenHash !== tokenHash || pass.status !== "ISSUED") {
      return NextResponse.json({ error: "Invalid delegate pass." }, { status: 400 });
    }

    if (pass.releaseAt > new Date()) {
      return NextResponse.json({ error: "Pass not released yet." }, { status: 409 });
    }

    const existing = await prisma.checkin.findUnique({
      where: {
        passId_eventId: {
          passId: pass.id,
          eventId: pass.eventId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        duplicate: true,
        checkedIn: true,
        checkedInAt: existing.checkedInAt.toISOString(),
      });
    }

    const organizer = actor?.email
      ? await prisma.user.upsert({
          where: { email: actor.email },
          update: {},
          create: {
            email: actor.email,
            name: actor.email.split("@")[0],
            role: actor.role === "admin" ? "ADMIN" : "ORGANIZER",
          },
        })
      : null;

    const created = await prisma.checkin.create({
      data: {
        passId: pass.id,
        registrationId: pass.registrationId,
        eventId: pass.eventId,
        checkedInById: organizer?.id,
        deviceMeta: body.deviceMeta ? String(body.deviceMeta) : undefined,
      },
    });

    await prisma.registration.update({
      where: { id: pass.registrationId },
      data: {
        checkedIn: true,
        checkedInAt: created.checkedInAt,
      },
    });

    await prisma.notification.create({
      data: {
        userId: pass.registration.userId,
        eventId: pass.eventId,
        registrationId: pass.registrationId,
        title: "Check-in confirmed",
        message: `You have checked in successfully for ${pass.registration.event.title}.`,
        type: "CHECKED_IN",
      },
    });

    return NextResponse.json({
      duplicate: false,
      checkedIn: true,
      checkedInAt: created.checkedInAt.toISOString(),
      delegateName: pass.registration.user.name,
    });
  } catch {
    return NextResponse.json({ error: "Check-in failed." }, { status: 400 });
  }
}
