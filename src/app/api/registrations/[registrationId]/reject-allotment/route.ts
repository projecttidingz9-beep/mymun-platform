import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

/**
 * Delegate declines a released allotment (allot-first mode) instead of paying.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  const actorUserId = await resolveActorUserId(actor);
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "").trim();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId: actorUserId, deletedAt: null },
    select: {
      id: true,
      paid: true,
      status: true,
      released: true,
      eventId: true,
      event: { select: { title: true, organizerConfig: { select: { allocationMode: true } } } },
    },
  });

  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (registration.paid) {
    return NextResponse.json({ error: "Paid registrations cannot reject an allotment." }, { status: 400 });
  }
  if (
    registration.status !== RegistrationStatus.ALLOTTED ||
    !registration.released
  ) {
    return NextResponse.json(
      { error: "No released allotment is available to reject." },
      { status: 400 }
    );
  }

  const now = new Date();
  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: RegistrationStatus.PENDING,
      committeeName: null,
      portfolioName: null,
      portfolioId: null,
      allottedAt: null,
      released: false,
      releasedAt: null,
      paymentDeadlineAt: null,
      allotmentDeclinedAt: now,
    },
  });

  await prisma.paymentIntent.updateMany({
    where: { registrationId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  await prisma.notification.create({
    data: {
      userId: actorUserId,
      eventId: registration.eventId,
      registrationId,
      title: "Allotment declined",
      message: `You declined your allotment for ${registration.event.title}. Organizers may reassign the seat.`,
      type: "APP_STATUS",
      read: false,
    },
  });

  return NextResponse.json({ ok: true });
}
