import { Resend } from "resend";
import type { EventStatus } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { mergeOrganizerStoredBlob } from "./organizer-config-store";
import { mapManagedEventToOrganizerConference } from "./map-managed-event-to-organizer-conference";
import { env } from "./env";
import { logger } from "./logger";

export type ModerationAction = "approve" | "reject";

export type ModerateConferenceInput = {
  eventId: string;
  action: ModerationAction;
  note?: string;
  actorUserId: string;
  actorEmail: string;
  ip?: string;
  userAgent?: string;
};

export type ModerateConferenceResult = {
  eventId: string;
  status: EventStatus;
  title: string;
  organizerEmail: string | null;
};

const toSimpleHtml = (text: string) => {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;">${escaped}</div>`;
};

async function notifyOrganizerModeration(params: {
  to: string;
  title: string;
  action: ModerationAction;
  note?: string;
}) {
  const apiKey = env.resendApiKey();
  const fromEmail = env.resendFromEmail();
  if (!apiKey || !fromEmail) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://tidingz.com";
  const dashboardUrl = `${appUrl}/organizers/dashboard`;

  const isApprove = params.action === "approve";
  const subject = isApprove
    ? `Your conference "${params.title}" is now live on Tidingz`
    : `Updates needed for "${params.title}" on Tidingz`;

  const lines = isApprove
    ? [
        `Good news — your conference "${params.title}" has been approved and published on the Tidingz marketplace.`,
        "",
        `Manage your event: ${dashboardUrl}`,
      ]
    : [
        `Your submission "${params.title}" was not approved for publication yet.`,
        params.note?.trim() ? `\nFeedback from the platform team:\n${params.note.trim()}` : "",
        "",
        "Please update your conference and publish again when ready.",
        "",
        `Open your organizer dashboard: ${dashboardUrl}`,
      ];

  const text = lines.filter((l) => l !== undefined).join("\n");

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject,
      text,
      html: toSimpleHtml(text),
    });
  } catch (err) {
    logger.error("admin_moderation_email_failed", {
      error: err instanceof Error ? err.message : String(err),
      to: params.to,
    });
  }
}

export async function moderateConference(
  input: ModerateConferenceInput
): Promise<ModerateConferenceResult> {
  const eventId = input.eventId.trim();
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  const note = input.note?.trim().slice(0, 2000) || undefined;

  const existing = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      owner: { select: { email: true } },
    },
  });

  if (!existing) {
    throw new Error("Event not found.");
  }

  if (existing.status !== "REVIEW" && input.action === "approve") {
    throw new Error("Only conferences pending review can be approved.");
  }

  const nextStatus: EventStatus = input.action === "approve" ? "PUBLISHED" : "DRAFT";
  const blobStatus = input.action === "approve" ? "Published" : "Draft";
  const moderatedAt = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { status: nextStatus },
    });

    await mergeOrganizerStoredBlob(eventId, {
      status: blobStatus,
      adminRejectionNote: input.action === "reject" ? note || "Please review and update your submission." : "",
      adminModeratedAt: moderatedAt,
      adminModeratedBy: input.actorEmail,
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        eventId,
        action: input.action === "approve" ? "admin.conference.approve" : "admin.conference.reject",
        entity: "Event",
        entityId: eventId,
        before: { status: existing.status },
        after: {
          status: nextStatus,
          note: input.action === "reject" ? note ?? null : null,
        },
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  });

  const conference = await mapManagedEventToOrganizerConference(eventId);
  const organizerEmail =
    conference?.ownerEmail?.trim().toLowerCase() ||
    existing.owner?.email?.trim().toLowerCase() ||
    null;

  if (organizerEmail) {
    await notifyOrganizerModeration({
      to: organizerEmail,
      title: conference?.title || existing.title,
      action: input.action,
      note,
    });
  }

  return {
    eventId,
    status: nextStatus,
    title: conference?.title || existing.title,
    organizerEmail,
  };
}

export type AdminReviewEventDetail = {
  event: {
    id: string;
    title: string;
    status: EventStatus;
    slug: string | null;
    startDate: string;
    endDate: string;
    createdAt: string;
    updatedAt: string;
    coverImageUrl: string | null;
    submittedAt: string | null;
  };
  organizer: {
    name: string;
    email: string | null;
    contactDetail?: string;
  };
  summary: {
    city: string;
    country: string;
    venue?: string;
    level: string;
    capacity: number;
    description?: string;
    registrationDeadline?: string;
    committeeCount: number;
    categoryCount: number;
    adminRejectionNote?: string;
  };
};

export async function getAdminReviewEventDetail(eventId: string): Promise<AdminReviewEventDetail | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      coverImageUrl: true,
      owner: { select: { name: true, email: true } },
    },
  });

  if (!event) return null;

  const conference = await mapManagedEventToOrganizerConference(eventId);
  if (!conference) return null;

  return {
    event: {
      id: event.id,
      title: conference.title,
      status: event.status,
      slug: event.slug,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      coverImageUrl: event.coverImageUrl,
      submittedAt: event.status === "REVIEW" ? event.updatedAt.toISOString() : null,
    },
    organizer: {
      name: conference.organizerName,
      email: conference.ownerEmail ?? event.owner?.email ?? null,
      contactDetail: conference.contactDetail,
    },
    summary: {
      city: conference.city,
      country: conference.country,
      venue: conference.venue,
      level: conference.level,
      capacity: conference.capacity,
      description: conference.description,
      registrationDeadline: conference.registrationDeadline,
      committeeCount: conference.committees.length,
      categoryCount: conference.registrationCategories.length,
      adminRejectionNote: conference.adminRejectionNote,
    },
  };
}
