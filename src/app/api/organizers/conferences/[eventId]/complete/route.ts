import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@/generated/prisma/client";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  roleLabelForApplicationType,
  upsertParticipationInProfile,
} from "@/lib/server/sync-delegate-profile-from-organizer";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const { eventId } = await context.params;
  if (!eventId || !(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      status: true,
      organizerConfig: {
        select: {
          registrationCategories: {
            select: { categoryKey: true, applicationType: true },
          },
        },
      },
      registrations: {
        where: {
          deletedAt: null,
          status: RegistrationStatus.ALLOTTED,
          released: true,
        },
        select: {
          id: true,
          userId: true,
          categoryId: true,
          committeeName: true,
          portfolioName: true,
          user: { select: { delegateProfile: true } },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Conference not found." }, { status: 404 });
  }
  if (event.status === "ARCHIVED") {
    return NextResponse.json({ ok: true, syncedParticipationCount: 0, alreadyCompleted: true });
  }
  if (event.endDate.getTime() > Date.now()) {
    return NextResponse.json(
      { error: "The conference can only be completed after its end date." },
      { status: 409 }
    );
  }

  const applicationTypeByCategory = new Map(
    (event.organizerConfig?.registrationCategories ?? []).map((category) => [
      category.categoryKey,
      category.applicationType,
    ])
  );
  const year = event.startDate.getFullYear();

  const completed = await prisma.$transaction(
    async (tx) => {
      const claimed = await tx.event.updateMany({
        where: { id: event.id, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED" },
      });
      if (claimed.count === 0) return false;

      for (const registration of event.registrations) {
        const applicationType = registration.categoryId
          ? applicationTypeByCategory.get(registration.categoryId) || "delegate"
          : "delegate";
        const nextProfile = upsertParticipationInProfile(
          registration.user.delegateProfile,
          {
            id: `part-sync-${event.id}`,
            conferenceName: event.title,
            committee: registration.committeeName ?? undefined,
            role: roleLabelForApplicationType(applicationType),
            year,
            countryRepresented: registration.portfolioName ?? undefined,
          },
          event.id
        );
        await tx.user.update({
          where: { id: registration.userId },
          data: { delegateProfile: nextProfile },
        });
      }

      if (event.registrations.length > 0) {
        await tx.notification.createMany({
          data: event.registrations.map((registration) => ({
            userId: registration.userId,
            eventId: event.id,
            registrationId: registration.id,
            title: "Conference completed",
            message: `${event.title} has been added to your MUN participation history.`,
            type: NotificationType.APP_STATUS,
            read: false,
          })),
        });
      }
      return true;
    },
    { timeout: 30_000 }
  );
  if (!completed) {
    return NextResponse.json({ ok: true, syncedParticipationCount: 0, alreadyCompleted: true });
  }

  return NextResponse.json({
    ok: true,
    syncedParticipationCount: event.registrations.length,
  });
}
