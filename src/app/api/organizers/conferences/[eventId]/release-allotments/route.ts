import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@/generated/prisma/client";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { ensurePendingPaymentIntent } from "@/lib/server/payments";
import { moneyNumber } from "@/lib/server/decimal-money";
import { logger } from "@/lib/server/logger";
import { prisma } from "@/lib/server/prisma";

/**
 * Allotment-release workflow: organizers can draft committee/portfolio assignments (Allot / Auto-assign)
 * without delegates finding out immediately. Nothing is visible to the delegate — no notification, no
 * status change on their dashboard — until this endpoint is called, which flips `released`/`releasedAt`
 * on the underlying Registration rows and fires the "you've been allotted" notification for each one.
 *
 * For ALLOT_FIRST conferences, also sets paymentDeadlineAt and ensures a payment intent exists.
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

  const eventConfig = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      title: true,
      currency: true,
      organizerConfig: { select: { allocationMode: true, paymentDeadlineDays: true } },
    },
  });

  const allotFirst = eventConfig?.organizerConfig?.allocationMode === "ALLOT_FIRST";
  const deadlineDays = Math.max(1, eventConfig?.organizerConfig?.paymentDeadlineDays ?? 7);

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
      amount: true,
      paid: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, releasedCount: 0, released: [] });
  }

  // Allot-first: ensure payment intents before releasing so delegates can always pay.
  if (allotFirst) {
    const currency = eventConfig?.currency?.trim() || "INR";
    try {
      for (const reg of pending) {
        if (reg.paid) continue;
        const amount = moneyNumber(reg.amount);
        if (amount <= 0) continue;
        await ensurePendingPaymentIntent({
          registrationId: reg.id,
          amount,
          currency,
        });
      }
    } catch (error) {
      logger.error("release_allotments_payment_intent_failed", {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error:
            "Could not prepare payment for released allotments. Try again or contact support.",
        },
        { status: 500 }
      );
    }
  }

  const now = new Date();
  const paymentDeadlineAt = allotFirst
    ? new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000)
    : null;

  await prisma.registration.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: {
      released: true,
      releasedAt: now,
      ...(paymentDeadlineAt ? { paymentDeadlineAt } : {}),
      allotmentDeclinedAt: null,
    },
  });

  const deadlineLabel = paymentDeadlineAt
    ? paymentDeadlineAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  await prisma.notification.createMany({
    data: pending.map((reg) => {
      const base = `You have been allotted to ${reg.committeeName || "your committee"}${
        reg.portfolioName ? ` (${reg.portfolioName})` : ""
      } for ${eventConfig?.title || "the conference"}.`;
      const payNote =
        allotFirst && !reg.paid && moneyNumber(reg.amount) > 0 && deadlineLabel
          ? ` Please pay by ${deadlineLabel} to confirm your seat, or reject the allotment from your dashboard.`
          : "";
      return {
        userId: reg.userId,
        eventId,
        registrationId: reg.id,
        title: "Committee allocation confirmed",
        message: `${base}${payNote}`,
        type: NotificationType.APP_STATUS,
        read: false,
      };
    }),
  });

  return NextResponse.json({
    ok: true,
    releasedCount: pending.length,
    paymentDeadlineAt: paymentDeadlineAt?.toISOString() ?? null,
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
