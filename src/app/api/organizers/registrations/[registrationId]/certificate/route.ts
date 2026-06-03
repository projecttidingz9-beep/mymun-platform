import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(_request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "");
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, deletedAt: null, status: "ALLOTTED" },
    include: {
      user: { select: { name: true, email: true } },
      event: { select: { id: true, title: true, startDate: true, endDate: true } },
    },
  });
  if (!registration) {
    return NextResponse.json(
      { error: "Allotted registration not found." },
      { status: 404 }
    );
  }

  if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const organizerUser = actor
    ? await prisma.user.findUnique({
        where: { email: actor.email },
        select: { id: true },
      })
    : null;

  const certificate = await prisma.participationCertificate.upsert({
    where: { registrationId },
    create: {
      registrationId,
      eventId: registration.eventId,
      issuedByUserId: organizerUser?.id,
    },
    update: {
      issuedAt: new Date(),
      issuedByUserId: organizerUser?.id,
    },
  });

  await prisma.notification.create({
    data: {
      userId: registration.userId,
      eventId: registration.eventId,
      registrationId,
      title: "Participation certificate issued",
      message: `Your participation certificate for ${registration.event.title} is now available on your dashboard.`,
      type: "OTHER",
    },
  });

  return NextResponse.json({
    ok: true,
    certificateId: certificate.id,
    issuedAt: certificate.issuedAt.toISOString(),
    delegateName: registration.user.name,
    eventName: registration.event.title,
    committeeName: registration.committeeName,
    portfolioName: registration.portfolioName,
    categoryName: registration.categoryName,
  });
}
