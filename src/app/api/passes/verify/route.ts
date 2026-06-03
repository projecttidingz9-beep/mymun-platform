import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor } from "@/lib/server/auth";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import {
  alreadyUsedResponse,
  assertOrganizerCanAccessPass,
  isPassAlreadyUsed,
  loadPassFromQrToken,
} from "@/lib/server/verify-delegate-pass";

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

    const loaded = await loadPassFromQrToken(qrToken);
    if (!loaded.ok) {
      return NextResponse.json(
        loaded.status === 409 ? { valid: false, error: loaded.error } : { error: loaded.error },
        { status: loaded.status }
      );
    }

    const access = await assertOrganizerCanAccessPass(actor, loaded.pass.eventId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { pass } = loaded;
    const isAllotted = pass.registration.status === RegistrationStatus.ALLOTTED;

    if (isPassAlreadyUsed(pass)) {
      return NextResponse.json(alreadyUsedResponse(), { status: 409 });
    }

    return NextResponse.json({
      valid: true,
      passId: pass.id,
      registrationId: pass.registrationId,
      eventId: pass.eventId,
      delegateName: pass.registration.user.name,
      delegateEmail: pass.registration.user.email,
      eventName: pass.registration.event.title,
      committeeName: isAllotted ? pass.registration.committeeName : null,
      portfolioName: isAllotted ? pass.registration.portfolioName : null,
      categoryName: pass.registration.categoryName,
      checkedIn: false,
      checkedInAt: null,
    });
  } catch {
    return NextResponse.json({ error: "Could not verify QR pass." }, { status: 400 });
  }
}
