import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import {
  issueDelegatePassForRegistration,
  resolveReleaseAt,
} from "@/lib/server/issue-delegate-pass";
import { prisma } from "@/lib/server/prisma";
import { upsertRegistrationFromClient } from "@/lib/server/registration-sync";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request);
    if (!requireOrganizer(actor)) {
      return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
    }
    const verifyBlock = await requireVerifiedEmail(actor);
    if (verifyBlock) return verifyBlock;

    const body = await request.json();
    let registration = await prisma.registration.findUnique({
      where: { id: String(body.registrationId) },
      include: { event: true, user: true, pass: true },
    });

    if (!registration && body.syncPayload) {
      const synced = await upsertRegistrationFromClient(body.syncPayload);
      registration = await prisma.registration.findUnique({
        where: { id: synced.id },
        include: { event: true, user: true, pass: true },
      });
    }

    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }
    if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
      return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
    }

    const eligible =
      registration.paid &&
      registration.status === RegistrationStatus.ALLOTTED &&
      registration.committeeName;
    if (!eligible) {
      return NextResponse.json(
        { error: "Registration is not eligible for pass issuance." },
        { status: 400 }
      );
    }

    const releaseAt = resolveReleaseAt(
      registration.event.startDate,
      body.releaseAt ? String(body.releaseAt) : undefined
    );

    const result = await issueDelegatePassForRegistration(registration.id, {
      releaseAt,
      notify: true,
    });

    if (result.alreadyIssued) {
      return NextResponse.json({ passId: result.passId, alreadyIssued: true });
    }

    if (!result.issued) {
      return NextResponse.json(
        { error: result.skipReason || "Failed to issue delegate pass." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      passId: result.passId,
      registrationId: registration.id,
      releaseAt: result.releaseAt,
      qrToken: result.qrToken,
      alreadyIssued: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to issue delegate pass.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
