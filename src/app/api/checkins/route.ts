import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { prisma } from "@/lib/server/prisma";
import {
  alreadyUsedResponse,
  assertOrganizerCanAccessPass,
  isPassAlreadyUsed,
  loadPassFromQrToken,
  PASS_ALREADY_USED_ERROR,
} from "@/lib/server/verify-delegate-pass";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  const verifyBlock = await requireVerifiedEmail(actor);
  if (verifyBlock) return verifyBlock;

  const rateKey = `checkins:${actor.email}`;
  const rateOk = await consumeRateLimitBucket({
    key: rateKey,
    windowMs: 60_000,
    limit: 120,
  });
  if (!rateOk) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const qrToken = String(body.qrToken || "");

    const loaded = await loadPassFromQrToken(qrToken);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const access = await assertOrganizerCanAccessPass(actor, loaded.pass.eventId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { pass } = loaded;

    if (isPassAlreadyUsed(pass)) {
      const checkedInAt =
        pass.checkins[0]?.checkedInAt?.toISOString() ||
        pass.registration.checkedInAt?.toISOString() ||
        null;
      return NextResponse.json(
        {
          ...alreadyUsedResponse(),
          checkedIn: true,
          checkedInAt,
        },
        { status: 409 }
      );
    }

    const organizer = await prisma.user.findUnique({
      where: { email: actor.email },
      select: { id: true },
    });

    try {
      const created = await prisma.$transaction(async (tx) => {
        const checkin = await tx.checkin.create({
          data: {
            passId: pass.id,
            registrationId: pass.registrationId,
            eventId: pass.eventId,
            checkedInById: organizer?.id,
            deviceMeta: body.deviceMeta ? String(body.deviceMeta) : undefined,
          },
        });

        await tx.registration.update({
          where: { id: pass.registrationId },
          data: {
            checkedIn: true,
            checkedInAt: checkin.checkedInAt,
          },
        });

        await tx.delegatePass.update({
          where: { id: pass.id },
          data: { status: "REVOKED" },
        });

        return checkin;
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.checkin.findUnique({
          where: {
            passId_eventId: {
              passId: pass.id,
              eventId: pass.eventId,
            },
          },
        });
        return NextResponse.json(
          {
            ...alreadyUsedResponse(),
            checkedIn: true,
            checkedInAt: existing?.checkedInAt.toISOString() ?? null,
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ error: PASS_ALREADY_USED_ERROR }, { status: 409 });
  }
}
