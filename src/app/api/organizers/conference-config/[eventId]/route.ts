import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { normalizeConferenceScheduleEntries } from "@/lib/conference-schedule";
import type { RegistrationCategory } from "@/lib/types";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
import { getOrganizerPreviewConfig, mergeOrganizerStoredBlob } from "@/lib/server/organizer-config-store";
import { logger } from "@/lib/server/logger";
import { persistRegistrationCategories } from "@/lib/server/persist-registration-categories";
import { formatOrganizerSyncError } from "@/lib/server/persist-organizer-conference-sync";
import { MARKETPLACE_CACHE_TAG } from "@/lib/server/marketplace-queries";
import { prisma } from "@/lib/server/prisma";

function safeRevalidateMarketplaceCache(): void {
  try {
    revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
  } catch (error) {
    logger.error("marketplace_cache_revalidate_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function isClientConfigError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("organizerconferenceconfig missing") ||
    normalized.includes("event not found") ||
    normalized.includes("pricing phase") ||
    normalized.includes("complete every pricing phase") ||
    normalized.includes("incomplete:")
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  return NextResponse.json({ config: await getOrganizerPreviewConfig(eventId) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  const actorUserId = await resolveActorUserId(actor);
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerUserId: true },
  });
  const existingConfig = await getOrganizerPreviewConfig(eventId);
  const ownerUserIdFromConfig = (existingConfig?.ownerUserId || "").trim();
  const ownerEmailFromConfig = (existingConfig?.ownerEmail || "").trim().toLowerCase();
  const actorEmail = (actor?.email || "").trim().toLowerCase();
  const isOwner =
    (actorUserId && event?.ownerUserId && actorUserId === event.ownerUserId) ||
    (actorUserId && ownerUserIdFromConfig && actorUserId === ownerUserIdFromConfig) ||
    (actorEmail && ownerEmailFromConfig && actorEmail === ownerEmailFromConfig);

  const previewPatch: Record<string, unknown> = {
    eventId,
    ...(isOwner
      ? {
          ownerUserId:
            typeof body.ownerUserId === "string" ? body.ownerUserId : actorUserId || undefined,
          ownerEmail: typeof body.ownerEmail === "string" ? body.ownerEmail : actor?.email || undefined,
          organizerTeamEmails: Array.isArray(body.organizerTeamEmails)
            ? body.organizerTeamEmails.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean)
            : undefined,
        }
      : {}),
    title: typeof body.title === "string" ? body.title : undefined,
    city: typeof body.city === "string" ? body.city : undefined,
    country: typeof body.country === "string" ? body.country : undefined,
    organizerName: typeof body.organizerName === "string" ? body.organizerName : undefined,
    contactDetail: typeof body.contactDetail === "string" ? body.contactDetail : undefined,
    currency: typeof body.currency === "string" ? body.currency.trim().toUpperCase() : undefined,
    tags: Array.isArray(body.tags) ? body.tags.map((entry) => String(entry)).filter(Boolean) : undefined,
    capacity:
      typeof body.capacity === "number"
        ? body.capacity
        : typeof body.capacity === "string"
          ? Number(body.capacity)
          : undefined,
    level:
      body.level === "High School" || body.level === "University" || body.level === "Open"
        ? body.level
        : undefined,
    venue: typeof body.venue === "string" ? body.venue : undefined,
    startDate: typeof body.startDate === "string" ? body.startDate : undefined,
    endDate: typeof body.endDate === "string" ? body.endDate : undefined,
    registrationDeadline: typeof body.registrationDeadline === "string" ? body.registrationDeadline : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    termsAndConditions:
      typeof body.termsAndConditions === "string" ? body.termsAndConditions : undefined,
    refundPolicy: typeof body.refundPolicy === "string" ? body.refundPolicy : undefined,
    codeOfConduct: typeof body.codeOfConduct === "string" ? body.codeOfConduct : undefined,
    faqNotes: typeof body.faqNotes === "string" ? body.faqNotes : undefined,
    logoImageUrl: typeof body.logoImageUrl === "string" ? body.logoImageUrl : undefined,
    bannerImageUrl: typeof body.bannerImageUrl === "string" ? body.bannerImageUrl : undefined,
    brandPrimaryColor: typeof body.brandPrimaryColor === "string" ? body.brandPrimaryColor : undefined,
    brandSecondaryColor: typeof body.brandSecondaryColor === "string" ? body.brandSecondaryColor : undefined,
    socialLinks:
      typeof body.socialLinks === "object" && body.socialLinks !== null
        ? (body.socialLinks as {
            website?: string;
            instagram?: string;
            linkedin?: string;
            twitter?: string;
          })
        : undefined,
    whatIsIncluded: Array.isArray(body.whatIsIncluded)
      ? body.whatIsIncluded.map((entry) => String(entry)).filter(Boolean)
      : undefined,
    conferenceSchedule: Array.isArray(body.conferenceSchedule)
      ? normalizeConferenceScheduleEntries(body.conferenceSchedule)
      : undefined,
    awards: Array.isArray(body.awards) ? body.awards : undefined,
    previousEditions: Array.isArray(body.previousEditions) ? body.previousEditions : undefined,
    commonDocuments: Array.isArray(body.commonDocuments) ? body.commonDocuments : undefined,
    registrationCategories: Array.isArray(body.registrationCategories)
      ? body.registrationCategories
      : undefined,
  };

  try {
    await mergeOrganizerStoredBlob(eventId, previewPatch);

    if (Array.isArray(previewPatch.registrationCategories)) {
      await persistRegistrationCategories(
        eventId,
        previewPatch.registrationCategories as RegistrationCategory[]
      );
      safeRevalidateMarketplaceCache();
    }

    const venueFromParts = [previewPatch.city, previewPatch.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
  const resolvedVenue =
    (typeof previewPatch.venue === "string" ? previewPatch.venue.trim() : "") ||
    venueFromParts ||
    null;

  const relationalPatch: {
    title?: string;
    startDate?: Date;
    endDate?: Date;
    currency?: string;
    coverImageUrl?: string | null;
    venue?: string | null;
    logoImageUrl?: string | null;
    bannerImageUrl?: string | null;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    linkedinUrl?: string | null;
    twitterUrl?: string | null;
    brandPrimaryColor?: string | null;
    brandSecondaryColor?: string | null;
  } = {};

  if (typeof previewPatch.title === "string" && previewPatch.title.trim()) {
    relationalPatch.title = previewPatch.title.trim();
  }
  if (typeof previewPatch.startDate === "string" && previewPatch.startDate) {
    relationalPatch.startDate = new Date(previewPatch.startDate);
  }
  if (typeof previewPatch.endDate === "string" && previewPatch.endDate) {
    relationalPatch.endDate = new Date(previewPatch.endDate);
  }
  if (typeof previewPatch.currency === "string" && previewPatch.currency.trim()) {
    relationalPatch.currency = previewPatch.currency.trim().toUpperCase();
  }
  if (typeof previewPatch.bannerImageUrl === "string") {
    relationalPatch.coverImageUrl = previewPatch.bannerImageUrl.trim() || null;
    relationalPatch.bannerImageUrl = previewPatch.bannerImageUrl.trim() || null;
  }
  if (resolvedVenue) {
    relationalPatch.venue = resolvedVenue;
  }
  if (typeof previewPatch.logoImageUrl === "string") {
    relationalPatch.logoImageUrl = previewPatch.logoImageUrl.trim() || null;
  }
  const social = previewPatch.socialLinks;
  if (social && typeof social === "object" && !Array.isArray(social)) {
    const links = social as Record<string, unknown>;
    if (typeof links.website === "string") relationalPatch.websiteUrl = links.website.trim() || null;
    if (typeof links.instagram === "string") relationalPatch.instagramUrl = links.instagram.trim() || null;
    if (typeof links.linkedin === "string") relationalPatch.linkedinUrl = links.linkedin.trim() || null;
    if (typeof links.twitter === "string") relationalPatch.twitterUrl = links.twitter.trim() || null;
  }
  if (typeof previewPatch.brandPrimaryColor === "string") {
    relationalPatch.brandPrimaryColor = previewPatch.brandPrimaryColor.trim() || null;
  }
  if (typeof previewPatch.brandSecondaryColor === "string") {
    relationalPatch.brandSecondaryColor = previewPatch.brandSecondaryColor.trim() || null;
  }

  if (Object.keys(relationalPatch).length > 0) {
    const { title, startDate, endDate, coverImageUrl, currency, ...configFields } = relationalPatch;
    if (title || startDate || endDate || coverImageUrl !== undefined || currency) {
      await prisma.event.update({
        where: { id: eventId },
        data: {
          ...(title ? { title } : {}),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
          ...(currency ? { currency } : {}),
        },
      });
    }
    const configUpdate = Object.fromEntries(
      Object.entries(configFields).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(configUpdate).length > 0) {
      await prisma.organizerConferenceConfig.upsert({
        where: { eventId },
        update: configUpdate,
        create: {
          eventId,
          ...configUpdate,
        },
      });
    }
  }

  const saved = await getOrganizerPreviewConfig(eventId);

    safeRevalidateMarketplaceCache();

    return NextResponse.json({ config: saved });
  } catch (error) {
    const message = formatOrganizerSyncError(error);
    logger.error("conference_config_patch_failed", {
      eventId,
      error: message,
    });
    const status = isClientConfigError(message) ? 400 : 500;
    return NextResponse.json(
      {
        error:
          status === 400
            ? message
            : "Could not save conference settings.",
      },
      { status }
    );
  }
}
