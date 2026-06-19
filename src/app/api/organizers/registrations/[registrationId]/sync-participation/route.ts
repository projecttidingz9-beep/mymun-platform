import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  roleLabelForApplicationType,
  upsertParticipationInProfile,
} from "@/lib/server/sync-delegate-profile-from-organizer";

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
      categoryId: true,
      categoryName: true,
      committeeName: true,
      portfolioName: true,
      event: { select: { title: true, startDate: true } },
    },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const chairRole = typeof body.role === "string" ? body.role : undefined;

  let applicationType = "delegate";
  if (registration.categoryId) {
    const categoryRow = await prisma.registrationCategoryConfig.findFirst({
      where: {
        categoryKey: registration.categoryId,
        organizerConfig: { eventId: registration.eventId },
      },
      select: { applicationType: true },
    });
    if (categoryRow?.applicationType) {
      applicationType = categoryRow.applicationType;
    }
  }

  const recipient = await prisma.user.findUnique({
    where: { id: registration.userId },
    select: { id: true, delegateProfile: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "Recipient user not found." }, { status: 404 });
  }

  const role = roleLabelForApplicationType(applicationType, chairRole);
  const year = registration.event.startDate.getFullYear();
  const nextProfile = upsertParticipationInProfile(
    recipient.delegateProfile,
    {
      id: `part-sync-${registration.eventId}`,
      conferenceName: registration.event.title,
      committee: registration.committeeName ?? undefined,
      role,
      year,
      countryRepresented: registration.portfolioName ?? undefined,
    },
    registration.eventId
  );

  await prisma.user.update({
    where: { id: recipient.id },
    data: { delegateProfile: nextProfile },
  });

  return NextResponse.json({ ok: true });
}
