import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "");
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, deletedAt: null },
    select: {
      id: true,
      eventId: true,
      userId: true,
      paid: true,
      event: { select: { title: true } },
    },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!registration.paid) {
    return NextResponse.json({ error: "Only paid registrations can be refunded." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.registration.update({
      where: { id: registrationId },
      data: {
        paid: false,
        status: RegistrationStatus.REJECTED,
        allottedAt: null,
        committeeName: null,
        portfolioName: null,
        portfolioId: null,
      },
    });

    await tx.paymentIntent.updateMany({
      where: { registrationId },
      data: {
        status: "REFUNDED",
        notes: "Refunded by organizer",
      },
    });

    await tx.delegatePass.updateMany({
      where: { registrationId },
      data: { status: "REVOKED" },
    });
  });

  await prisma.notification.create({
    data: {
      userId: registration.userId,
      eventId: registration.eventId,
      registrationId,
      title: "Registration refunded",
      message: `Your registration for ${registration.event.title} has been refunded by the organizers.`,
      type: "OTHER",
    },
  });

  return NextResponse.json({ ok: true, refunded: true });
}
