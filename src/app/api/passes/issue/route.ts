import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { hashToken, signPassToken } from "@/lib/server/pass-token";
import { prisma } from "@/lib/server/prisma";
import { upsertRegistrationFromClient } from "@/lib/server/registration-sync";

function resolveReleaseAt(startDate: Date, requestedReleaseAt?: string) {
  if (requestedReleaseAt) return new Date(requestedReleaseAt);
  const release = new Date(startDate);
  release.setDate(release.getDate() - 3);
  return release;
}

export async function POST(request: NextRequest) {
  try {
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

    if (registration.pass && registration.pass.status === "ISSUED") {
      return NextResponse.json({ passId: registration.pass.id, alreadyIssued: true });
    }

    const releaseAt = resolveReleaseAt(
      registration.event.startDate,
      body.releaseAt ? String(body.releaseAt) : undefined
    );

    const created = await prisma.delegatePass.create({
      data: {
        registrationId: registration.id,
        eventId: registration.eventId,
        releaseAt,
        qrTokenHash: "pending",
      },
    });

    const token = await signPassToken({
      passId: created.id,
      registrationId: registration.id,
      eventId: registration.eventId,
    });
    const tokenHash = hashToken(token);

    await prisma.delegatePass.update({
      where: { id: created.id },
      data: { qrTokenHash: tokenHash },
    });

    await prisma.notification.create({
      data: {
        userId: registration.userId,
        eventId: registration.eventId,
        registrationId: registration.id,
        title: "Digital pass issued",
        message: `Your digital delegate pass for ${registration.event.title} is now available.`,
        type: "pass_issued",
      },
    });

    return NextResponse.json({
      passId: created.id,
      registrationId: registration.id,
      releaseAt: releaseAt.toISOString(),
      qrToken: token,
      alreadyIssued: false,
    });
  } catch {
    return NextResponse.json({ error: "Failed to issue delegate pass." }, { status: 500 });
  }
}
