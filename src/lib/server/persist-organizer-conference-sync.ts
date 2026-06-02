import type { OrganizerConference } from "@/lib/types";
import type { EventStatus } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { mergeOrganizerStoredBlob } from "./organizer-config-store";

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

    if (conference.committees.length > 0) {
      await tx.committeeConfig.deleteMany({
        where: { organizerConfigId: configRow.id },
      });
    }

    for (const c of conference.committees) {
      await tx.committeeConfig.create({
        data: {
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
        },
      });

      for (const q of c.customQuestions ?? []) {
        await tx.applicationQuestion.create({
          data: {
            committeeId: c.id,
            label: q.question,
            type: "text",
            required: q.required,
          },
        });
      }
    }

    const phaseMap = new Map<string, (typeof conference.registrationCategories)[number]["pricingPhases"][number]>();
    for (const cat of conference.registrationCategories || []) {
      for (const phase of cat.pricingPhases || []) {
        if (!phaseMap.has(phase.id)) phaseMap.set(phase.id, phase);
      }
    }

    if (phaseMap.size > 0) {
      await tx.pricingPhaseConfig.deleteMany({
        where: { organizerConfigId: configRow.id },
      });

      for (const phase of phaseMap.values()) {
        const committeePriceObj = Object.fromEntries(
          (phase.committeePrices || []).map((cp) => [cp.committeeId, cp.price])
        );
        await tx.pricingPhaseConfig.create({
          data: {
            organizerConfigId: configRow.id,
            name: phase.name,
            startDate: new Date(phase.startDate),
            endDate: new Date(phase.endDate),
            basePrice: phase.basePrice,
            committeePriceJson: JSON.stringify(committeePriceObj),
          },
        });
      }
    }
  });

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
