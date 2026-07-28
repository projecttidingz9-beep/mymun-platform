import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@/generated/prisma/client";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { decodeOrganizerStoredBlobRecord } from "@/lib/server/organizer-blob-decode";
import { prisma } from "@/lib/server/prisma";
import {
  appendAwardToProfile,
  roleLabelForApplicationType,
  upsertParticipationInProfile,
} from "@/lib/server/sync-delegate-profile-from-organizer";

type ProfileAwardLike = {
  conferenceName?: unknown;
  title?: unknown;
  category?: unknown;
};

function normalizeAwardSignature(conferenceName: string, title: string, category?: string): string {
  return `${conferenceName.trim().toLowerCase()}::${title.trim().toLowerCase()}::${(category || "")
    .trim()
    .toLowerCase()}`;
}

function readAwardSignaturesFromProfile(delegateProfile: unknown): Set<string> {
  if (!delegateProfile || typeof delegateProfile !== "object") return new Set<string>();
  const profile = delegateProfile as Record<string, unknown>;
  if (!Array.isArray(profile.munAwards)) return new Set<string>();
  const signatures = new Set<string>();
  for (const entry of profile.munAwards as ProfileAwardLike[]) {
    const conferenceName =
      typeof entry?.conferenceName === "string" ? entry.conferenceName.trim() : "";
    const title = typeof entry?.title === "string" ? entry.title.trim() : "";
    const category = typeof entry?.category === "string" ? entry.category.trim() : "";
    if (!conferenceName || !title) continue;
    signatures.add(normalizeAwardSignature(conferenceName, title, category));
  }
  return signatures;
}

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
          description: true,
          registrationCategories: {
            select: { categoryKey: true, applicationType: true },
          },
        },
      },
      registrations: {
        where: {
          deletedAt: null,
          status: RegistrationStatus.ALLOTTED,
        },
        select: {
          id: true,
          userId: true,
          categoryId: true,
          released: true,
          committeeName: true,
          portfolioName: true,
          user: { select: { email: true, delegateProfile: true } },
        },
      },
      awards: {
        select: {
          id: true,
          category: true,
          prizeTitle: true,
          recipientRegistrationId: true,
          recipientUserId: true,
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
  const organizerBlob = decodeOrganizerStoredBlobRecord(event.organizerConfig?.description);
  const secretariatRoleByUserId = new Map<string, string>();
  const secretariatRoleByEmail = new Map<string, string>();
  const chairRoleByRegistrationId = new Map<string, string>();
  const chairRoleByEmail = new Map<string, string>();
  if (Array.isArray(organizerBlob?.organizerTeam)) {
    for (const entry of organizerBlob.organizerTeam as Array<Record<string, unknown>>) {
      if (!entry || typeof entry !== "object") continue;
      const teamType = entry.teamType === "secretariat" ? "secretariat" : "organizer";
      if (teamType !== "secretariat") continue;
      const role = typeof entry.role === "string" ? entry.role.trim() : "";
      if (!role) continue;
      const userId = typeof entry.userId === "string" ? entry.userId.trim() : "";
      const email =
        typeof entry.email === "string" ? entry.email.trim().toLowerCase() : "";
      if (userId) secretariatRoleByUserId.set(userId, role);
      if (email) secretariatRoleByEmail.set(email, role);
    }
  }
  if (Array.isArray(organizerBlob?.committees)) {
    for (const committee of organizerBlob.committees as Array<Record<string, unknown>>) {
      if (!committee || typeof committee !== "object" || !Array.isArray(committee.chairs)) continue;
      for (const chair of committee.chairs as Array<Record<string, unknown>>) {
        if (!chair || typeof chair !== "object") continue;
        const role = typeof chair.role === "string" ? chair.role.trim() : "";
        if (!role) continue;
        const registrationId = typeof chair.id === "string" ? chair.id.trim() : "";
        const email =
          typeof chair.email === "string" ? chair.email.trim().toLowerCase() : "";
        if (registrationId) chairRoleByRegistrationId.set(registrationId, role);
        if (email) chairRoleByEmail.set(email, role);
      }
    }
  }
  const year = event.startDate.getFullYear();
  const shouldSyncRegistration = (registration: (typeof event.registrations)[number]) => {
    const applicationType = registration.categoryId
      ? applicationTypeByCategory.get(registration.categoryId) || "delegate"
      : "delegate";
    if (applicationType === "organizer" || applicationType === "secretariat") return true;
    return registration.released === true;
  };
  const registrationsForSync = event.registrations.filter(shouldSyncRegistration);
  const awardsByRegistrationId = new Map<
    string,
    Array<{
      id: string;
      category: string;
      prizeTitle: string | null;
    }>
  >();
  const awardsByUserId = new Map<
    string,
    Array<{
      id: string;
      category: string;
      prizeTitle: string | null;
    }>
  >();
  for (const award of event.awards) {
    const payload = {
      id: award.id,
      category: award.category,
      prizeTitle: award.prizeTitle,
    };
    if (award.recipientRegistrationId) {
      const list = awardsByRegistrationId.get(award.recipientRegistrationId) ?? [];
      list.push(payload);
      awardsByRegistrationId.set(award.recipientRegistrationId, list);
    }
    if (award.recipientUserId) {
      const list = awardsByUserId.get(award.recipientUserId) ?? [];
      list.push(payload);
      awardsByUserId.set(award.recipientUserId, list);
    }
  }

  const completed = await prisma.$transaction(
    async (tx) => {
      const claimed = await tx.event.updateMany({
        where: { id: event.id, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED" },
      });
      if (claimed.count === 0) return false;

      for (const registration of registrationsForSync) {
        const applicationType = registration.categoryId
          ? applicationTypeByCategory.get(registration.categoryId) || "delegate"
          : "delegate";
        let nextProfile = upsertParticipationInProfile(
          registration.user.delegateProfile,
          {
            id: `part-sync-${event.id}`,
            conferenceName: event.title,
            committee: registration.committeeName ?? undefined,
            role: roleLabelForApplicationType(
              applicationType,
              applicationType === "secretariat"
                ? secretariatRoleByUserId.get(registration.userId) ||
                    secretariatRoleByEmail.get(registration.user.email.trim().toLowerCase()) ||
                    null
                : applicationType === "chair"
                  ? chairRoleByRegistrationId.get(registration.id) ||
                      chairRoleByEmail.get(registration.user.email.trim().toLowerCase()) ||
                      null
                  : null
            ),
            year,
            countryRepresented: registration.portfolioName ?? undefined,
          },
          event.id
        );
        const existingAwardSignatures = readAwardSignaturesFromProfile(nextProfile);
        const registrationAwards = awardsByRegistrationId.get(registration.id) ?? [];
        const userAwards = awardsByUserId.get(registration.userId) ?? [];
        const dedupedAwards = [...registrationAwards, ...userAwards].filter(
          (award, index, all) =>
            all.findIndex((candidate) => candidate.id === award.id) === index
        );
        for (const award of dedupedAwards) {
          const title = (award.prizeTitle || award.category || "").trim();
          if (!title) continue;
          const category = award.category.trim() || undefined;
          const signature = normalizeAwardSignature(event.title, title, category);
          if (existingAwardSignatures.has(signature)) continue;
          const appended = appendAwardToProfile(nextProfile, {
            id: `award-sync-${event.id}-${award.id}`,
            title,
            conferenceName: event.title,
            year,
            category,
            committee: undefined,
            logoUrl: undefined,
          });
          nextProfile = appended.profile;
          existingAwardSignatures.add(signature);
        }
        await tx.user.update({
          where: { id: registration.userId },
          data: { delegateProfile: nextProfile },
        });
      }

      if (registrationsForSync.length > 0) {
        await tx.notification.createMany({
          data: registrationsForSync.map((registration) => ({
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
    syncedParticipationCount: registrationsForSync.length,
  });
}
