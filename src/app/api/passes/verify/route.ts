import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { hashToken, verifyPassToken } from "@/lib/server/pass-token";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  const rateKey = `passes:verify:${actor.email}`;
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
        checkins: true,
      },
    });

    if (!pass || pass.qrTokenHash !== tokenHash || pass.status !== "ISSUED") {
      return NextResponse.json({ error: "Invalid delegate pass." }, { status: 400 });
    }

    if (pass.releaseAt > new Date()) {
      return NextResponse.json({ error: "Pass not released yet.", valid: false }, { status: 409 });
    }

    const checkedIn = pass.checkins.length > 0 || pass.registration.checkedIn;
    return NextResponse.json({
      valid: true,
      passId: pass.id,
      registrationId: pass.registrationId,
      eventId: pass.eventId,
      delegateName: pass.registration.user.name,
      delegateEmail: pass.registration.user.email,
      eventName: pass.registration.event.title,
      committeeName: pass.registration.committeeName,
      portfolioName: pass.registration.portfolioName,
      categoryName: pass.registration.categoryName,
      checkedIn,
      checkedInAt:
        pass.checkins[0]?.checkedInAt?.toISOString() ||
        pass.registration.checkedInAt?.toISOString() ||
        null,
    });
  } catch {
    return NextResponse.json({ error: "Could not verify QR pass." }, { status: 400 });
  }
}
