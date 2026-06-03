import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { requireRegistrationOwner } from "@/lib/server/require-registration-owner";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(_request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "").trim();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await requireRegistrationOwner(actor, registrationId);
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const awards = await prisma.conferenceAward.findMany({
    where: {
      eventId: registration.eventId,
      OR: [
        { recipientRegistrationId: registrationId },
        { recipientUserId: registration.userId },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    awards: awards.map((award) => ({
      id: award.id,
      category: award.category,
      presetKey: award.presetKey,
      prizeTitle: award.prizeTitle,
      sponsorLogoUrl: award.sponsorLogoUrl,
      sponsorName: award.sponsorName,
      description: award.description,
      participantName: award.participantName,
      createdAt: award.createdAt.toISOString(),
    })),
  });
}
