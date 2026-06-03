import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import {
  AllotmentValidationError,
  validateAllotmentAssignment,
} from "@/lib/server/allotment-enforcement";
import {
  issueDelegatePassForRegistration,
  resolveReleaseAt,
} from "@/lib/server/issue-delegate-pass";
import { prisma } from "@/lib/server/prisma";

function mapOrganizerStatusToDb(
  status: string | undefined
): RegistrationStatus | undefined {
  if (!status) return undefined;
  if (status === "Allotted") return RegistrationStatus.ALLOTTED;
  if (status === "Waitlisted") return RegistrationStatus.WAITLISTED;
  if (status === "Rejected") return RegistrationStatus.REJECTED;
  if (status === "Pending" || status === "Invited") return RegistrationStatus.PENDING;
  return undefined;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "");
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, deletedAt: null },
    select: {
      id: true,
      eventId: true,
      userId: true,
      paid: true,
      event: { select: { startDate: true, title: true } },
    },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const allowOverride = body.allowOverride === true;

  const statusDb =
    typeof body.organizerStatus === "string"
      ? mapOrganizerStatusToDb(body.organizerStatus)
      : typeof body.status === "string"
        ? mapOrganizerStatusToDb(body.status)
        : undefined;

  const committeeName =
    typeof body.committeeName === "string" ? body.committeeName.trim() || null : undefined;
  const portfolioName =
    typeof body.portfolioName === "string" ? body.portfolioName.trim() || null : undefined;
  const portfolioId =
    typeof body.portfolioId === "string" ? body.portfolioId.trim() || null : undefined;

  const allottedAtRaw = body.allottedAt;
  const allottedAt =
    typeof allottedAtRaw === "string" && allottedAtRaw
      ? new Date(allottedAtRaw)
      : statusDb === RegistrationStatus.ALLOTTED
        ? new Date()
        : undefined;

  const paid = typeof body.paid === "boolean" ? body.paid : undefined;

  const nextAllottedAt =
    statusDb === RegistrationStatus.ALLOTTED
      ? allottedAt !== undefined
        ? allottedAt
        : new Date()
      : statusDb !== undefined
        ? null
        : undefined;

  let resolvedPortfolioId: string | null | undefined = portfolioId;
  if (statusDb === RegistrationStatus.ALLOTTED) {
    try {
      const validated = await validateAllotmentAssignment({
        eventId: registration.eventId,
        registrationId,
        committeeName: committeeName ?? null,
        portfolioName: portfolioName ?? null,
        portfolioId,
        allowOverride,
      });
      if (validated?.portfolioId) {
        resolvedPortfolioId = validated.portfolioId;
      }
    } catch (error) {
      if (error instanceof AllotmentValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  const organizerUser = actor
    ? await prisma.user.findUnique({
        where: { email: actor.email },
        select: { id: true },
      })
    : null;

  const wasPaid = registration.paid;

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      ...(statusDb !== undefined ? { status: statusDb } : {}),
      ...(committeeName !== undefined ? { committeeName } : {}),
      ...(portfolioName !== undefined ? { portfolioName } : {}),
      ...(resolvedPortfolioId !== undefined ? { portfolioId: resolvedPortfolioId } : {}),
      ...(paid !== undefined ? { paid } : {}),
      ...(nextAllottedAt !== undefined ? { allottedAt: nextAllottedAt } : {}),
    },
  });

  if (paid === true && !wasPaid && organizerUser) {
    await prisma.paymentIntent.updateMany({
      where: { registrationId, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        confirmedByUserId: organizerUser.id,
      },
    });

    await prisma.notification.create({
      data: {
        userId: registration.userId,
        eventId: registration.eventId,
        registrationId,
        title: "Payment confirmed",
        message: `Your payment for ${registration.event.title} has been confirmed by the organizers.`,
        type: "PAYMENT_CONFIRMED",
      },
    });
  }

  const updated = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { paid: true, status: true },
  });

  if (updated?.paid && updated.status === RegistrationStatus.ALLOTTED) {
    try {
      await issueDelegatePassForRegistration(registrationId, {
        releaseAt: resolveReleaseAt(registration.event.startDate),
      });
    } catch {
      // PATCH succeeded; pass issuance is best-effort.
    }
  }

  return NextResponse.json({ ok: true });
}
