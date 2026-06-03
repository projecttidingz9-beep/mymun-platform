import type { OrganizerConference } from "@/lib/types";
import type { EventStatus } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { mergeOrganizerStoredBlob } from "./organizer-config-store";

export const ORGANIZER_SYNC_TX_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
} as const;

export type PersistConferenceSyncOptions = {
  /**
   * Super-admin only: `"Published"` maps to `PUBLISHED`.
   * Otherwise organizer `"Published"` submits for platform review (`REVIEW`).
   */
  skipReviewGate?: boolean;
  /** When false, leave Event.status unchanged (config-only sync). Default true. */
  syncStatus?: boolean;
};

export function mapConferenceStatusToEvent(
  status: OrganizerConference["status"],
  options?: PersistConferenceSyncOptions
): EventStatus {
  if (status === "Published") {
    if (options?.skipReviewGate) return "PUBLISHED";
    return "REVIEW";
  }
  if (status === "Review") return "REVIEW";
  return "DRAFT";
}

const PROTECTED_EVENT_STATUSES: EventStatus[] = ["REVIEW", "PUBLISHED"];

export function resolveEventStatusForSync(
  currentDbStatus: EventStatus,
  clientStatus: OrganizerConference["status"],
  options?: PersistConferenceSyncOptions
): EventStatus {
  const mapped = mapConferenceStatusToEvent(clientStatus, options);

  if (clientStatus === "Published") {
    // Already live: config edits must not demote back to REVIEW for delegates.
    if (currentDbStatus === "PUBLISHED") {
      return "PUBLISHED";
    }
    return mapped;
  }

  if (
    clientStatus === "Draft" &&
    PROTECTED_EVENT_STATUSES.includes(currentDbStatus)
  ) {
    return currentDbStatus;
  }

  if (PROTECTED_EVENT_STATUSES.includes(currentDbStatus)) {
    return currentDbStatus;
  }

  return mapped;
}

function normalizeBlobStatusForSync(
  conference: OrganizerConference,
  eventStatus: EventStatus
): OrganizerConference["status"] {
  if (conference.status === "Published" && eventStatus === "REVIEW") {
    return "Review";
  }
  return conference.status;
}

function buildApplicantExtras(conference: OrganizerConference): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const a of conference.applicants) {
    const slice: Record<string, unknown> = {};
    if (a.assignmentHistory && a.assignmentHistory.length > 0) {
      slice.assignmentHistory = a.assignmentHistory;
    }
    if (a.status === "Invited") {
      slice.status = "Invited";
    }
    if (Object.keys(slice).length > 0) {
      const key = a.registrationId || a.id;
      out[key] = slice;
    }
  }
  return out;
}

function conferenceToBlobPayload(conference: OrganizerConference): Record<string, unknown> {
  const applicantExtras = buildApplicantExtras(conference);
  const { applicants: _a, ...rest } = conference;
  return {
    ...rest,
    applicants: [],
    ...(Object.keys(applicantExtras).length > 0 ? { applicantExtras } : {}),
  } as Record<string, unknown>;
}

export async function persistOrganizerConferenceSync(
  eventId: string,
  conference: OrganizerConference,
  options?: PersistConferenceSyncOptions
) {
  let resolvedEventStatus: EventStatus = mapConferenceStatusToEvent(conference.status, options);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    });
    if (!existing) {
      throw new Error("Event not found.");
    }

    resolvedEventStatus = options?.syncStatus === false
      ? existing.status
      : resolveEventStatusForSync(existing.status, conference.status, options);

    await tx.event.update({
      where: { id: eventId },
      data: {
        title: conference.title,
        startDate: new Date(conference.startDate),
        endDate: new Date(conference.endDate),
        ...(options?.syncStatus === false ? {} : { status: resolvedEventStatus }),
        coverImageUrl: conference.bannerImageUrl ?? null,
      },
    });

    const configRow = await tx.organizerConferenceConfig.findUnique({
      where: { eventId },
      select: { id: true },
    });
    if (!configRow) {
      throw new Error("OrganizerConferenceConfig missing for event.");
    }

    const venueFromParts = [conference.city, conference.country]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ");
    const resolvedVenue =
      conference.venue?.trim() || venueFromParts || null;

    await tx.organizerConferenceConfig.update({
      where: { eventId },
      data: {
        venue: resolvedVenue,
        logoImageUrl: conference.logoImageUrl ?? null,
        bannerImageUrl: conference.bannerImageUrl ?? null,
        websiteUrl: conference.socialLinks?.website ?? null,
        instagramUrl: conference.socialLinks?.instagram ?? null,
        linkedinUrl: conference.socialLinks?.linkedin ?? null,
        twitterUrl: conference.socialLinks?.twitter ?? null,
        brandPrimaryColor: conference.brandPrimaryColor ?? null,
        brandSecondaryColor: conference.brandSecondaryColor ?? null,
      },
    });

    await tx.committeeConfig.deleteMany({
      where: { organizerConfigId: configRow.id },
    });

    if (conference.committees.length > 0) {
      await tx.committeeConfig.createMany({
        data: conference.committees.map((c) => ({
          id: c.id,
          organizerConfigId: configRow.id,
          name: c.name,
          agenda: c.agenda,
          type: c.type ?? c.committeeType ?? null,
          seatCount: c.seatCount,
          basePrice: c.basePrice ?? null,
          chairName: c.chairName ?? null,
          chairEmail: c.chairEmail ?? null,
          visibility: c.isPublic === false ? "PRIVATE" : "PUBLIC",
        })),
      });

      const questionRows = conference.committees.flatMap((c) =>
        (c.customQuestions ?? []).map((q) => ({
          committeeId: c.id,
          label: q.question,
          type: "text",
          required: q.required,
        }))
      );
      if (questionRows.length > 0) {
        await tx.applicationQuestion.createMany({ data: questionRows });
      }

      const portfolioRows = conference.committees.flatMap((c) =>
        (c.portfolios ?? []).map((p) => ({
          id: p.id,
          committeeId: c.id,
          name: p.name,
          seatCount: p.seatCount > 0 ? p.seatCount : 1,
        }))
      );
      if (portfolioRows.length > 0) {
        await tx.portfolio.createMany({ data: portfolioRows });
      }
    }

    await tx.registrationCategoryConfig.deleteMany({
      where: { organizerConfigId: configRow.id },
    });

    if ((conference.registrationCategories || []).length > 0) {
      await tx.registrationCategoryConfig.createMany({
        data: conference.registrationCategories.map((cat) => ({
          id: cat.id,
          organizerConfigId: configRow.id,
          name: cat.name,
          applicationType: cat.applicationType || "delegate",
          description: cat.description ?? null,
          isOpen: cat.isOpen !== false,
          basePrice: cat.basePrice ?? 0,
          requiresCommitteeSelection: cat.requiresCommitteeSelection !== false,
          registrationDeadline: cat.registrationDeadline
            ? new Date(cat.registrationDeadline)
            : cat.deadlineOverride
              ? new Date(cat.deadlineOverride)
              : null,
          maxDelegatesPerDelegation: cat.maxDelegatesPerDelegation ?? null,
        })),
      });
    }

    await tx.conferenceAward.deleteMany({ where: { eventId } });
    if ((conference.awards ?? []).length > 0) {
      await tx.conferenceAward.createMany({
        data: (conference.awards ?? []).map((award) => ({
          eventId,
          category: award.category || "General",
          prizeTitle: award.prizeTitle || null,
          sponsorLogoUrl: award.sponsorLogoUrl ?? null,
          sponsorName: award.sponsorName ?? null,
          description: award.description ?? null,
          recipientRegistrationId: award.participantId ?? null,
          recipientUserId: award.participantUserId ?? null,
          participantName: award.participantName ?? null,
        })),
      });
    }

    const phaseMap = new Map<string, (typeof conference.registrationCategories)[number]["pricingPhases"][number]>();
    for (const cat of conference.registrationCategories || []) {
      for (const phase of cat.pricingPhases || []) {
        if (!phaseMap.has(phase.id)) phaseMap.set(phase.id, phase);
      }
    }

    await tx.pricingPhaseConfig.deleteMany({
      where: { organizerConfigId: configRow.id },
    });

    if (phaseMap.size > 0) {
      await tx.pricingPhaseConfig.createMany({
        data: [...phaseMap.values()].map((phase) => {
          const committeePriceObj = Object.fromEntries(
            (phase.committeePrices || []).map((cp) => [cp.committeeId, cp.price])
          );
          return {
            organizerConfigId: configRow.id,
            name: phase.name,
            startDate: new Date(phase.startDate),
            endDate: new Date(phase.endDate),
            basePrice: phase.basePrice,
            committeePriceJson: JSON.stringify(committeePriceObj),
          };
        }),
      });
    }
  }, ORGANIZER_SYNC_TX_OPTIONS);

  const normalizedConference = {
    ...conference,
    status: normalizeBlobStatusForSync(conference, resolvedEventStatus),
  };
  const blobPayload = conferenceToBlobPayload(normalizedConference);
  if (options?.syncStatus === false) {
    delete blobPayload.status;
  }
  await mergeOrganizerStoredBlob(eventId, blobPayload);
}

export function formatOrganizerSyncError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("expired transaction") ||
    message.includes("P2028") ||
    message.includes("timeout for this transaction")
  ) {
    return "Save took too long. Please try again in a moment.";
  }
  return message || "Sync failed.";
}
