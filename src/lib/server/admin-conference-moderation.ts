import { Resend } from "resend";
import type { EventStatus } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { mergeOrganizerStoredBlob } from "./organizer-config-store";
import { mapManagedEventToOrganizerConference } from "./map-managed-event-to-organizer-conference";
import { getOrganizerOverviewAnalytics } from "./organizer-overview";
import { PLATFORM_FEE_RATE, netAfterPlatformFee } from "@/lib/platform-finance";
import { getActivePhase } from "@/lib/pricing";
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

export type DeleteConferenceAsAdminInput = {
  eventId: string;
  actorUserId: string;
  actorEmail: string;
  ip?: string;
  userAgent?: string;
};

export type DeleteConferenceAsAdminResult = {
  eventId: string;
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

export async function moderateConferenceByStatus(input: {
  eventId: string;
  status: EventStatus;
  actorUserId: string;
  actorEmail: string;
  note?: string;
  ip?: string;
  userAgent?: string;
}): Promise<ModerateConferenceResult> {
  const eventId = input.eventId.trim();
  const existing = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { id: true, title: true, status: true, owner: { select: { email: true } } },
  });
  if (!existing) {
    throw new Error("Event not found.");
  }

  if (input.status === "PUBLISHED" && existing.status === "REVIEW") {
    return moderateConference({
      eventId,
      action: "approve",
      note: input.note,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  if (input.status === "DRAFT" && existing.status === "REVIEW") {
    return moderateConference({
      eventId,
      action: "reject",
      note: input.note,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  if (input.status === "SUSPENDED" && existing.status !== "PUBLISHED") {
    throw new Error("Only published conferences can be suspended.");
  }
  if (input.status === "PUBLISHED" && existing.status !== "SUSPENDED" && existing.status !== "REVIEW") {
    throw new Error("Only a suspended or in-review conference can be moved to Published this way.");
  }

  if (existing.status === input.status) {
    return {
      eventId,
      status: existing.status,
      title: existing.title,
      organizerEmail: existing.owner?.email?.trim().toLowerCase() ?? null,
    };
  }

  const blobStatus =
    input.status === "PUBLISHED"
      ? "Published"
      : input.status === "REVIEW"
        ? "Review"
        : input.status === "SUSPENDED"
          ? "Suspended"
          : "Draft";

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { status: input.status },
    });

    await mergeOrganizerStoredBlob(eventId, {
      status: blobStatus,
      adminModeratedAt: new Date().toISOString(),
      adminModeratedBy: input.actorEmail,
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        eventId,
        action: "admin.conference.status",
        entity: "Event",
        entityId: eventId,
        before: { status: existing.status },
        after: { status: input.status, note: input.note ?? null },
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  });

  const conference = await mapManagedEventToOrganizerConference(eventId);
  return {
    eventId,
    status: input.status,
    title: conference?.title || existing.title,
    organizerEmail:
      conference?.ownerEmail?.trim().toLowerCase() ||
      existing.owner?.email?.trim().toLowerCase() ||
      null,
  };
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

async function notifyOrganizerDeletion(params: { to: string; title: string }) {
  const apiKey = env.resendApiKey();
  const fromEmail = env.resendFromEmail();
  if (!apiKey || !fromEmail) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://tidingz.com";
  const dashboardUrl = `${appUrl}/organizers/dashboard`;
  const text = [
    `Your conference "${params.title}" has been removed from the Tidingz marketplace by the platform team.`,
    "",
    "If you believe this was a mistake, contact support or recreate your event from the organizer dashboard.",
    "",
    `Organizer dashboard: ${dashboardUrl}`,
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: `"${params.title}" removed from Tidingz marketplace`,
      text,
      html: toSimpleHtml(text),
    });
  } catch (err) {
    logger.error("admin_delete_email_failed", {
      error: err instanceof Error ? err.message : String(err),
      to: params.to,
    });
  }
}

export async function deleteConferenceAsAdmin(
  input: DeleteConferenceAsAdminInput
): Promise<DeleteConferenceAsAdminResult> {
  const eventId = input.eventId.trim();
  if (!eventId) {
    throw new Error("eventId is required.");
  }

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

  if (existing.status !== "PUBLISHED") {
    throw new Error("Only published conferences can be deleted from the marketplace.");
  }

  const deletedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { deletedAt },
    });

    await mergeOrganizerStoredBlob(eventId, {
      status: "Draft",
      adminModeratedAt: deletedAt.toISOString(),
      adminModeratedBy: input.actorEmail,
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        eventId,
        action: "admin.conference.delete",
        entity: "Event",
        entityId: eventId,
        before: { status: existing.status, deletedAt: null },
        after: { status: existing.status, deletedAt: deletedAt.toISOString() },
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  });

  const conference = await mapManagedEventToOrganizerConference(eventId);
  const title = conference?.title || existing.title;
  const organizerEmail =
    conference?.ownerEmail?.trim().toLowerCase() ||
    existing.owner?.email?.trim().toLowerCase() ||
    null;

  if (organizerEmail) {
    await notifyOrganizerDeletion({ to: organizerEmail, title });
  }

  return {
    eventId,
    title,
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
  /** The full original application form as the organizer submitted/edited it. */
  applicationForm: {
    title: string;
    organizerName: string;
    contactDetail?: string;
    ownerEmail?: string;
    city: string;
    country: string;
    venue?: string;
    level: string;
    capacity: number;
    currency?: string;
    startDate: string;
    endDate: string;
    registrationDeadline?: string;
    description?: string;
    termsAndConditions?: string;
    refundPolicy?: string;
    codeOfConduct?: string;
  };
  review: {
    registrationOpen: boolean;
    registeredCount: number;
    paidCount: number;
    revenueCollected: number;
    platformFeeRate: number;
    platformCut: number;
    organizerNetPayout: number;
  };
  bankingDetails: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  } | null;
  invoiceTemplate: {
    url: string | null;
    fileName: string | null;
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
      organizerConfig: { select: { invoiceTemplateUrl: true, invoiceTemplateFileName: true } },
    },
  });

  if (!event) return null;

  const conference = await mapManagedEventToOrganizerConference(eventId);
  if (!conference) return null;

  const openCategories = (conference.registrationCategories || []).filter((category) => category.isOpen !== false);
  const registrationOpen =
    openCategories.length > 0 &&
    openCategories.some((category) => {
      const phases = category.pricingPhases || [];
      return phases.length === 0 || Boolean(getActivePhase(phases));
    });

  const analytics = await getOrganizerOverviewAnalytics(eventId);
  const registeredCount = analytics.totalRegistrations;
  const revenueCollected = analytics.revenueCollected;
  const platformCut = Math.max(0, Math.round(revenueCollected * PLATFORM_FEE_RATE));

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
    applicationForm: {
      title: conference.title,
      organizerName: conference.organizerName,
      contactDetail: conference.contactDetail,
      ownerEmail: conference.ownerEmail ?? event.owner?.email ?? undefined,
      city: conference.city,
      country: conference.country,
      venue: conference.venue,
      level: conference.level,
      capacity: conference.capacity,
      currency: conference.currency,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      registrationDeadline: conference.registrationDeadline,
      description: conference.description,
      termsAndConditions: conference.termsAndConditions,
      refundPolicy: conference.refundPolicy,
      codeOfConduct: conference.codeOfConduct,
    },
    review: {
      registrationOpen,
      registeredCount,
      paidCount: Math.round((analytics.paymentCompletionRate / 100) * registeredCount),
      revenueCollected,
      platformFeeRate: PLATFORM_FEE_RATE,
      platformCut,
      organizerNetPayout: netAfterPlatformFee(revenueCollected),
    },
    bankingDetails: conference.bankingDetails
      ? {
          accountHolderName: conference.bankingDetails.accountHolderName,
          bankName: conference.bankingDetails.bankName,
          accountNumber: conference.bankingDetails.accountNumber,
          ifscCode: conference.bankingDetails.ifscCode,
          upiId: conference.bankingDetails.upiId,
        }
      : null,
    invoiceTemplate: {
      url: event.organizerConfig?.invoiceTemplateUrl ?? null,
      fileName: event.organizerConfig?.invoiceTemplateFileName ?? null,
    },
  };
}
