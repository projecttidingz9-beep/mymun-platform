import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer } from "@/lib/server/auth";
import { getOrganizerPreviewConfig, setOrganizerPreviewConfig } from "@/lib/server/organizer-config-store";

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

  return NextResponse.json({ config: getOrganizerPreviewConfig(eventId) });
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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const saved = setOrganizerPreviewConfig(eventId, {
    eventId,
    title: typeof body.title === "string" ? body.title : undefined,
    city: typeof body.city === "string" ? body.city : undefined,
    country: typeof body.country === "string" ? body.country : undefined,
    organizerName: typeof body.organizerName === "string" ? body.organizerName : undefined,
    venue: typeof body.venue === "string" ? body.venue : undefined,
    startDate: typeof body.startDate === "string" ? body.startDate : undefined,
    endDate: typeof body.endDate === "string" ? body.endDate : undefined,
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
      ? body.conferenceSchedule
          .map((entry) => {
            const item = entry as Record<string, unknown>;
            return {
              id: String(item.id || `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
              day: String(item.day || ""),
              fromTime: String(item.fromTime || ""),
              toTime: String(item.toTime || ""),
              title: String(item.title || ""),
            };
          })
          .filter((entry) => entry.day && entry.fromTime && entry.toTime && entry.title)
      : undefined,
  });

  return NextResponse.json({ config: saved });
}
