import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { appendAwardToProfile } from "@/lib/server/sync-delegate-profile-from-organizer";

export async function POST(
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
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const recipientUserId =
    typeof body.recipientUserId === "string" ? body.recipientUserId.trim() : "";
  const recipientUserEmail =
    typeof body.recipientUserEmail === "string" ? body.recipientUserEmail.trim().toLowerCase() : "";
  const awardTitle = typeof body.awardTitle === "string" ? body.awardTitle.trim() : "";
  const conferenceName = typeof body.conferenceName === "string" ? body.conferenceName.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : undefined;
  const committee = typeof body.committee === "string" ? body.committee.trim() : undefined;
  const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : undefined;

  if (!awardTitle || !conferenceName) {
    return NextResponse.json({ error: "awardTitle and conferenceName are required." }, { status: 400 });
  }
  if (!recipientUserId && !recipientUserEmail) {
    return NextResponse.json({ error: "Recipient user is required." }, { status: 400 });
  }

  const recipient = recipientUserId
    ? await prisma.user.findUnique({
        where: { id: recipientUserId },
        select: { id: true, delegateProfile: true },
      })
    : await prisma.user.findUnique({
        where: { email: recipientUserEmail },
        select: { id: true, delegateProfile: true },
      });

  if (!recipient) {
    return NextResponse.json({ error: "Recipient user not found." }, { status: 404 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startDate: true },
  });

  const { profile } = appendAwardToProfile(recipient.delegateProfile, {
    id: `mun-award-${Date.now()}`,
    title: awardTitle,
    conferenceName,
    year: event?.startDate.getFullYear(),
    category,
    committee,
    logoUrl,
  });

  await prisma.user.update({
    where: { id: recipient.id },
    data: { delegateProfile: profile },
  });

  return NextResponse.json({ ok: true });
}
