import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
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
import { logger } from "@/lib/server/logger";
import { organizerRegistrationPatchSchema } from "@/lib/server/validators/registration";

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
  const parsedBody = organizerRegistrationPatchSchema.safeParse(body);
  if (!parsedBody.success) {
    const msg = parsedBody.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const validated = parsedBody.data;

  const statusDb =
    typeof validated.organizerStatus === "string"
      ? mapOrganizerStatusToDb(validated.organizerStatus)
      : typeof validated.status === "string"
        ? mapOrganizerStatusToDb(validated.status)
        : undefined;

  const committeeName =
    typeof validated.committeeName === "string" ? validated.committeeName.trim() || null : undefined;
  const portfolioName =
    typeof validated.portfolioName === "string" ? validated.portfolioName.trim() || null : undefined;
  const portfolioId =
    typeof validated.portfolioId === "string" ? validated.portfolioId.trim() || null : undefined;

  const allottedAtRaw = validated.allottedAt;
  const allottedAt =
    typeof allottedAtRaw === "string" && allottedAtRaw
      ? new Date(allottedAtRaw)
      : statusDb === RegistrationStatus.ALLOTTED
        ? new Date()
        : undefined;

  const paid = typeof validated.paid === "boolean" ? validated.paid : undefined;

  const nextAllottedAt =
    statusDb === RegistrationStatus.ALLOTTED
      ? allottedAt !== undefined
        ? allottedAt
        : new Date()
      : statusDb !== undefined
        ? null
        : undefined;

  let resolvedPortfolioId: string | null | undefined = portfolioId;

  const updateData = {
    ...(statusDb !== undefined ? { status: statusDb } : {}),
    ...(committeeName !== undefined ? { committeeName } : {}),
    ...(portfolioName !== undefined ? { portfolioName } : {}),
    ...(resolvedPortfolioId !== undefined ? { portfolioId: resolvedPortfolioId } : {}),
    ...(paid !== undefined ? { paid } : {}),
    ...(nextAllottedAt !== undefined ? { allottedAt: nextAllottedAt } : {}),
    // Every (re-)allotment starts as an unreleased draft — the delegate only learns of it once the
    // organizer explicitly releases the batch via /release-allotments. Moving an already-released
    // delegate to a new committee re-drafts it so the change is reviewed before being surfaced again.
    ...(statusDb === RegistrationStatus.ALLOTTED ? { released: false, releasedAt: null } : {}),
  };

  try {
    if (statusDb === RegistrationStatus.ALLOTTED) {
      await prisma.$transaction(
        async (tx) => {
          const validated = await validateAllotmentAssignment({
            eventId: registration.eventId,
            registrationId,
            committeeName: committeeName ?? null,
            portfolioName: portfolioName ?? null,
            portfolioId,
            tx,
          });
          if (validated?.portfolioId) {
            resolvedPortfolioId = validated.portfolioId;
          }
          await tx.registration.update({
            where: { id: registrationId },
            data: {
              ...updateData,
              ...(validated?.portfolioId !== undefined
                ? { portfolioId: validated.portfolioId }
                : resolvedPortfolioId !== undefined
                  ? { portfolioId: resolvedPortfolioId }
                  : {}),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } else if (Object.keys(updateData).length > 0) {
      await prisma.registration.update({
        where: { id: registrationId },
        data: updateData,
      });
    }
  } catch (error) {
    if (error instanceof AllotmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Committee capacity changed. Please retry." },
        { status: 409 }
      );
    }
    logger.error("organizer_registration_patch_failed", {
      registrationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not update registration." }, { status: 500 });
  }

  const organizerUser = actor
    ? await prisma.user.findUnique({
        where: { email: actor.email },
        select: { id: true },
      })
    : null;

  const wasPaid = registration.paid;

  if (paid === true && !wasPaid && organizerUser) {
    const intent = await prisma.paymentIntent.findUnique({
      where: { registrationId },
      select: { provider: true },
    });
    if (intent?.provider === "CASHFREE") {
      return NextResponse.json(
        { error: "Cashfree payments are confirmed automatically and cannot be marked paid manually." },
        { status: 400 }
      );
    }

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
    } catch (passError) {
      logger.warn("organizer_registration_pass_issue_failed", {
        registrationId,
        error: passError instanceof Error ? passError.message : String(passError),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
