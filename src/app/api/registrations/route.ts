import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { getRequestActor } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";
import {
  createRegistrationAndPayment,
  DuplicateActiveRegistrationError,
} from "@/lib/server/payments";
import {
  RegistrationValidationError,
  serializeRegistrationPreferences,
  validateRegistrationRequest,
} from "@/lib/server/validate-registration";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (actor.role === "organizer") {
    return NextResponse.json({ error: "Organizers cannot register as delegates." }, { status: 403 });
  }

  const verifyBlock = await requireVerifiedEmail(actor);
  if (verifyBlock) return verifyBlock;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const registrationId = String(body.registrationId || "").trim() || `reg-${randomUUID()}`;

    const validated = await validateRegistrationRequest(body);

    const event = await prisma.event.findFirst({
      where: {
        id: validated.eventId,
        deletedAt: null,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        ownerUserId: true,
        organizerConfig: { select: { allocationMode: true } },
      },
    });

    if (!event) {
      return NextResponse.json(
        {
          error:
            "This conference is not open for registration (missing from server or not published).",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: actor.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User profile not found. Sign in again." }, { status: 400 });
    }

    const committeeName =
      typeof body.committeeName === "string" && body.committeeName.trim()
        ? body.committeeName.trim()
        : undefined;

    const prefs = serializeRegistrationPreferences(body);
    const allotFirst = event.organizerConfig?.allocationMode === "ALLOT_FIRST";

    const result = await createRegistrationAndPayment({
      registrationId,
      userId: user.id,
      eventId: validated.eventId,
      categoryName: validated.categoryName,
      categoryId: validated.categoryId,
      committeeName,
      committeePreferencesJson: prefs.committeePreferencesJson,
      portfolioPreferencesJson: prefs.portfolioPreferencesJson,
      countryPreferencesJson: prefs.countryPreferencesJson,
      amount: validated.pricing.amount,
      currency: validated.pricing.currency,
      deferPayment: allotFirst && validated.pricing.amount > 0,
    });

    if (prefs.formAnswersJson) {
      await prisma.registration.update({
        where: { id: result.registrationId },
        data: { formAnswersJson: prefs.formAnswersJson },
      });
    }

    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          eventId: event.id,
          registrationId: result.registrationId,
          title: "Registration submitted",
          message: `You've registered for ${event.title}.`,
          type: "APP_STATUS",
        },
      });
      if (event.ownerUserId && event.ownerUserId !== user.id) {
        await prisma.notification.create({
          data: {
            userId: event.ownerUserId,
            eventId: event.id,
            registrationId: result.registrationId,
            title: "New registration",
            message: `A delegate registered for ${event.title}.`,
            type: "APP_STATUS",
          },
        });
      }
    } catch {
      // Non-blocking — registration already succeeded.
    }

    const registeredAt = new Date().toLocaleDateString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const clientRegistration = {
      id: result.registrationId,
      conferenceId: validated.eventId,
      conferenceTitle: event.title,
      categoryId: String(body.categoryId || "delegate"),
      categoryName: validated.categoryName,
      committeeId: validated.committeeConfigId,
      committeeName,
      committeePreferences: validated.committeePreferences,
      portfolioPreferencesByCommittee: body.portfolioPreferencesByCommittee as
        | Record<string, string[]>
        | undefined,
      formAnswers: (body.formAnswers || {}) as Record<string, string | number | boolean | string[]>,
      pricingPhaseId: validated.pricing.phaseId,
      pricingPhaseName: validated.pricing.phaseName,
      status: "Pending" as const,
      registeredAt,
      paid: result.paid,
      amount: result.amount,
      userEmail: actor.email,
      organizerStatus: "Pending" as const,
    };

    return NextResponse.json({
      ok: true,
      registration: result,
      clientRegistration,
    });
  } catch (error) {
    if (error instanceof DuplicateActiveRegistrationError) {
      return NextResponse.json(
        {
          error: error.message,
          existingRegistrationId: error.existingRegistrationId,
        },
        { status: 409 }
      );
    }
    if (error instanceof RegistrationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "You already have an active registration for this conference." },
        { status: 409 }
      );
    }
    logger.error("registration_create_failed", {
      email: actor.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
