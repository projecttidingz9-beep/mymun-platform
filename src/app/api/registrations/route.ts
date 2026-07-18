import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { getRequestActor } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { normalizeDelegationCode } from "@/lib/delegation-code";
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
    const submittedBody = (await request.json()) as Record<string, unknown>;
    const user = await prisma.user.findUnique({
      where: { email: actor.email },
      select: { id: true, name: true, delegateProfile: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User profile not found. Sign in again." }, { status: 400 });
    }
    const profile =
      user.delegateProfile && typeof user.delegateProfile === "object"
        ? (user.delegateProfile as Record<string, unknown>)
        : {};
    const profileName =
      [profile.firstName, profile.lastName]
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => value.trim())
        .join(" ") || user.name.trim();
    const profileSchool = typeof profile.school === "string" ? profile.school.trim() : "";
    const profilePhone = typeof profile.phone === "string" ? profile.phone.trim() : "";
    const profileCountry = typeof profile.country === "string" ? profile.country.trim() : "";
    if (!profileName || !profileSchool || !profilePhone || !profileCountry) {
      return NextResponse.json(
        { error: "Complete your name, school, phone, and country in your profile before registering." },
        { status: 400 }
      );
    }
    const submittedAnswers =
      submittedBody.formAnswers &&
      typeof submittedBody.formAnswers === "object" &&
      !Array.isArray(submittedBody.formAnswers)
        ? (submittedBody.formAnswers as Record<string, unknown>)
        : {};
    const body: Record<string, unknown> = {
      ...submittedBody,
      fullName: profileName,
      school: profileSchool,
      phone: profilePhone,
      formAnswers: {
        ...submittedAnswers,
        fullName: profileName,
        school: profileSchool,
        phone: profilePhone,
        country: profileCountry,
      },
    };
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

    const committeeName =
      typeof body.committeeName === "string" && body.committeeName.trim()
        ? body.committeeName.trim()
        : undefined;

    const prefs = serializeRegistrationPreferences(body);
    const allotFirst = event.organizerConfig?.allocationMode === "ALLOT_FIRST";
    let delegationLink:
      | { id: string; inviteToken: string; schoolName: string | null; isHead: boolean }
      | undefined;
    const delegationCode = normalizeDelegationCode(String(body.delegationCode || ""));
    if (validated.applicationType === "delegation") {
      if (!delegationCode) {
        return NextResponse.json(
          { error: "Create a delegation or join one with a team code before registering." },
          { status: 400 }
        );
      }
      const delegation = await prisma.delegation.findUnique({
        where: { inviteToken: delegationCode },
        select: {
          id: true,
          eventId: true,
          inviteToken: true,
          schoolName: true,
          status: true,
          ownerUserId: true,
          members: { where: { userId: user.id }, select: { id: true }, take: 1 },
        },
      });
      if (
        !delegation ||
        delegation.eventId !== validated.eventId ||
        delegation.status !== "OPEN" ||
        (delegation.ownerUserId !== user.id && delegation.members.length === 0)
      ) {
        return NextResponse.json(
          { error: "This delegation code is invalid or you have not joined this team." },
          { status: 400 }
        );
      }
      delegationLink = {
        id: delegation.id,
        inviteToken: delegation.inviteToken,
        schoolName: delegation.schoolName,
        isHead: delegation.ownerUserId === user.id,
      };
    } else {
      if (delegationCode) {
        return NextResponse.json(
          { error: "A delegation code can only be used with Delegation Registration." },
          { status: 400 }
        );
      }
      const teamAffiliation = await prisma.delegation.findFirst({
        where: {
          eventId: validated.eventId,
          OR: [{ ownerUserId: user.id }, { members: { some: { userId: user.id } } }],
        },
        select: { id: true },
      });
      if (teamAffiliation) {
        return NextResponse.json(
          {
            error:
              "You belong to a delegation for this conference. Select Delegation Registration to continue.",
          },
          { status: 400 }
        );
      }
    }

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
      formAnswersJson: prefs.formAnswersJson,
      delegationId: delegationLink?.id,
      isDelegationHead: delegationLink?.isHead,
      amount: validated.pricing.amount,
      currency: validated.pricing.currency,
      deferPayment: allotFirst && validated.pricing.amount > 0,
    });

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
    } catch (notifyError) {
      logger.warn("registration_notification_failed", {
        registrationId: result.registrationId,
        error: notifyError instanceof Error ? notifyError.message : String(notifyError),
      });
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
      delegationId: delegationLink?.id,
      delegationSchoolName: delegationLink?.schoolName ?? undefined,
      delegationInviteToken: delegationLink?.isHead ? delegationLink.inviteToken : undefined,
      isDelegationHead: delegationLink?.isHead,
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
