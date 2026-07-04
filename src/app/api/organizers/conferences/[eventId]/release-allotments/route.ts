import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@/generated/prisma/client";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

/**
 * Allotment-release workflow: organizers can draft committee/portfolio assignments (Allot / Auto-assign)
 * without delegates finding out immediately. Nothing is visible to the delegate — no notification, no
 * status change on their dashboard — until this endpoint is called, which flips `released`/`releasedAt`
 * on the underlying Registration rows and fires the "you've been allotted" notification for each one.
 *
 * Body: `{ registrationIds?: string[] }`. When omitted, every unreleased allotted registration for the
 * event is released ("assign all -> confirm -> release" in one click).
 */
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

  const body = (await request.json().catch(() => ({}))) as { registrationIds?: unknown };
  const requestedIds = Array.isArray(body.registrationIds)
    ? body.registrationIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : undefined;

  const pending = await prisma.registration.findMany({
    where: {
      eventId,
      deletedAt: null,
      status: RegistrationStatus.ALLOTTED,
      released: false,
      ...(requestedIds ? { id: { in: requestedIds } } : {}),
    },
    select: {
      id: true,
      userId: true,
      committeeName: true,
      portfolioName: true,
      event: { select: { title: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, releasedCount: 0, released: [] });
  }

  const now = new Date();

  await prisma.registration.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { released: true, releasedAt: now },
  });

  await prisma.notification.createMany({
    data: pending.map((reg) => ({
      userId: reg.userId,
      eventId,
      registrationId: reg.id,
      title: "Committee allocation confirmed",
      message: `You have been allotted to ${reg.committeeName || "your committee"}${
        reg.portfolioName ? ` (${reg.portfolioName})` : ""
      } for ${reg.event.title}.`,
      type: NotificationType.APP_STATUS,
      read: false,
    })),
  });

  return NextResponse.json({
    ok: true,
    releasedCount: pending.length,
    released: pending.map((reg) => ({
      registrationId: reg.id,
      userId: reg.userId,
      userEmail: reg.user.email,
      name: reg.user.name,
      committeeName: reg.committeeName,
      portfolioName: reg.portfolioName,
    })),
  });
}
