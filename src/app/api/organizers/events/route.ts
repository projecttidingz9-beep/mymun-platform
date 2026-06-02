import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer, resolveActorUserId } from "@/lib/server/auth";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";
import { prisma } from "@/lib/server/prisma";
import { mergeOrganizerStoredBlob } from "@/lib/server/organizer-config-store";
import { mapManagedEventToOrganizerConference } from "@/lib/server/map-managed-event-to-organizer-conference";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const verifyBlock = await requireVerifiedEmail(actor);
  if (verifyBlock) return verifyBlock;

  const actorUserId = await resolveActorUserId(actor);
  if (!actorUserId) {
    return NextResponse.json({ error: "User profile not found." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const title = String(body.title || "").trim();
  const city = String(body.city || "").trim();
  const country = String(body.country || "").trim();
  const organizerName = String(body.organizerName || "").trim();
  const contactDetail = String(body.contactDetail || "").trim();
  const startDate = String(body.startDate || "").trim();
  const endDate = String(body.endDate || "").trim();
  const registrationDeadline = String(body.registrationDeadline || "").trim();
  const capacity = typeof body.capacity === "number" ? body.capacity : Number(body.capacity);
  const level =
    body.level === "High School" || body.level === "University" || body.level === "Open"
      ? body.level
      : "High School";

  if (!title || !city || !country || !organizerName || !contactDetail || !startDate || !endDate || !registrationDeadline) {
    return NextResponse.json({ error: "Missing required conference fields." }, { status: 400 });
  }
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return NextResponse.json({ error: "Capacity must be a positive number." }, { status: 400 });
  }

  const eventId = `evt-${randomUUID()}`;
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  const registrationCategoriesFromBody = Array.isArray(body.registrationCategories)
    ? body.registrationCategories
    : [
        {
          id: "cat-default",
          name: "Delegate Registration",
          description: "Default delegate category.",
          applicationType: "delegate",
          isOpen: true,
          deadlineOverride: registrationDeadline,
          basePrice: 0,
          requiresCommitteeSelection: false,
          formFields: [],
          pricingPhases: [],
        },
      ];

  await prisma.$transaction(async (tx) => {
    await tx.event.create({
      data: {
        id: eventId,
        title,
        startDate: new Date(`${startDate}T12:00:00.000Z`),
        endDate: new Date(`${endDate}T12:00:00.000Z`),
        status: "DRAFT",
        ownerUserId: actorUserId,
        currency: typeof body.currency === "string" ? body.currency : "INR",
        organizerConfig: {
          create: {
            venue: venue || null,
            description: description || null,
          },
        },
      },
    });
  });

  await mergeOrganizerStoredBlob(eventId, {
    eventId,
    ownerUserId: actorUserId,
    ownerEmail: actor?.email ?? undefined,
    title,
    city,
    country,
    organizerName,
    contactDetail,
    venue: venue || undefined,
    capacity,
    level,
    startDate,
    endDate,
    registrationDeadline,
    description: description || undefined,
    socialLinks: typeof body.socialLinks === "object" && body.socialLinks !== null ? body.socialLinks : {},
    registrationCategories: registrationCategoriesFromBody,
    committees: [],
    announcements: [],
    statusEmailTemplates: undefined,
  });

  const conference = await mapManagedEventToOrganizerConference(eventId);
  return NextResponse.json({ conference });
}
