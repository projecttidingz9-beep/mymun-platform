import type { OrganizerConference } from "@/lib/types";
import type { EventStatus } from "@/generated/prisma/enums";
import { prisma, runPrismaTransaction } from "./prisma";
import { mergeOrganizerStoredBlob } from "./organizer-config-store";
import { syncRegistrationCategoriesToDb } from "./persist-registration-categories";
import { env } from "./env";

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
  let previousEventStatus: EventStatus | null = null;

  await runPrismaTransaction(async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    });
    if (!existing) {
      throw new Error("Event not found.");
    }
    previousEventStatus = existing.status;

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

    const existingCfg = await tx.organizerConferenceConfig.findUnique({
      where: { eventId },
      select: { allocationMode: true },
    });

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
        portfolioMatrixVisibility: conference.portfolioMatrixVisibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
        // Allocation mode is set once and immutable: ignore attempts to change it after it has a value.
        ...(existingCfg?.allocationMode
          ? {}
          : conference.allocationMode === "PAY_FIRST" || conference.allocationMode === "ALLOT_FIRST"
            ? { allocationMode: conference.allocationMode }
            : {}),
        ...(conference.paymentDeadlineDays != null
          ? { paymentDeadlineDays: conference.paymentDeadlineDays }
          : {}),
      },
    });

    await tx.committeeConfig.deleteMany({
      where: { organizerConfigId: configRow.id },
    });

    if (conference.committees.length > 0) {
      await tx.committeeConfig.createMany({
        data: conference.committees.map((c) => {
          const noPortfolio = c.noPortfolio === true;
          const derivedSeatCount = noPortfolio
            ? c.seatCount
            : (c.portfolios ?? []).length > 0
              ? (c.portfolios ?? []).reduce((sum, p) => sum + (p.seatCount > 0 ? p.seatCount : 0), 0)
              : c.seatCount;
          return {
            id: c.id,
            organizerConfigId: configRow.id,
            name: c.name,
            agenda: c.agenda,
            agendasJson:
              c.additionalAgendas && c.additionalAgendas.length > 0
                ? JSON.stringify(c.additionalAgendas)
                : null,
            type: c.type ?? c.committeeType ?? c.customTypeLabel ?? null,
            committeeFormat: c.committeeFormat ?? null,
            metadataJson: c.metadata ? JSON.stringify(c.metadata) : null,
            // Position papers are retired — never write deadlines for the legacy column.
            positionPaperDeadline: null,
            logoImageUrl: c.logoImageUrl ?? null,
            noPortfolio,
            seatCount: derivedSeatCount > 0 ? derivedSeatCount : 1,
            basePrice: c.basePrice ?? null,
            chairName: c.chairs?.[0]?.name ?? c.chairName ?? null,
            chairEmail: c.chairs?.[0]?.email ?? c.chairEmail ?? null,
            chairsJson: c.chairs && c.chairs.length > 0 ? JSON.stringify(c.chairs) : null,
            visibility: c.isPublic === false ? "PRIVATE" : "PUBLIC",
          };
        }),
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

      const documentRows = conference.committees.flatMap((c) =>
        (c.documents ?? []).map((doc) => ({
          id: doc.id,
          committeeId: c.id,
          title: doc.title,
          category: doc.category,
          fileUrl: doc.url,
          version: null as string | null,
        }))
      );
      if (documentRows.length > 0) {
        await tx.committeeDocument.createMany({ data: documentRows });
      }
    }

    await syncRegistrationCategoriesToDb(
      tx,
      configRow.id,
      conference.registrationCategories || []
    );

    await tx.conferenceAward.deleteMany({ where: { eventId } });
    if ((conference.awards ?? []).length > 0) {
      await tx.conferenceAward.createMany({
        data: (conference.awards ?? []).map((award) => ({
          eventId,
          category: award.category || "General",
          prizeTitle: award.prizeTitle || null,
          amount: award.amount && award.amount > 0 ? award.amount : null,
          description: award.description ?? null,
          recipientRegistrationId: award.participantId ?? null,
          recipientUserId: award.participantUserId ?? null,
          recipientDelegationId: award.recipientDelegationId ?? null,
          participantName: award.participantName ?? null,
        })),
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

  if (
    resolvedEventStatus === "REVIEW" &&
    previousEventStatus !== "REVIEW" &&
    options?.syncStatus !== false
  ) {
    try {
      const adminEmail = env.adminEmail();
      const adminUser = await prisma.user.findUnique({
        where: { email: adminEmail },
        select: { id: true },
      });
      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            eventId,
            title: "Conference submitted for review",
            message: `"${conference.title}" is waiting for platform approval.`,
            type: "OTHER",
          },
        });
      }
    } catch {
      // Non-blocking admin alert.
    }
  }
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
