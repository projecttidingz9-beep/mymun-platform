import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { getRequestActor } from "@/lib/server/auth";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";
import { resolveServerRegistrationAmount } from "@/lib/server/resolve-registration-price";
import {
  createRegistrationAndPayment,
  DuplicateActiveRegistrationError,
} from "@/lib/server/payments";

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
    const body = await request.json();
    const eventId = String(body.eventId || "").trim();
    const registrationId = String(body.registrationId || "").trim() || `reg-${randomUUID()}`;
    const categoryName = String(body.categoryName || "").trim();
    const committeeConfigId =
      typeof body.committeeConfigId === "string" && body.committeeConfigId.trim()
        ? body.committeeConfigId.trim()
        : undefined;

    if (!eventId || !categoryName) {
      return NextResponse.json({ error: "eventId and categoryName are required." }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        deletedAt: null,
        status: "PUBLISHED",
      },
      select: { id: true, title: true },
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

    const pricing = await resolveServerRegistrationAmount({
      eventId,
      committeeConfigId,
    });

    const committeeName =
      typeof body.committeeName === "string" && body.committeeName.trim()
        ? body.committeeName.trim()
        : undefined;
    const portfolioName =
      typeof body.portfolioName === "string" && body.portfolioName.trim()
        ? body.portfolioName.trim()
        : undefined;

    const result = await createRegistrationAndPayment({
      registrationId,
      userId: user.id,
      eventId,
      categoryName,
      committeeName,
      portfolioName,
      amount: pricing.amount,
      currency: pricing.currency,
    });

    const registeredAt = new Date().toLocaleDateString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const clientRegistration = {
      id: result.registrationId,
      conferenceId: eventId,
      conferenceTitle: event.title,
      categoryId: String(body.categoryId || "delegate"),
      categoryName,
      committeeId: committeeConfigId,
      committeeName,
      committeePreferences: Array.isArray(body.committeePreferences)
        ? body.committeePreferences
        : undefined,
      portfolioPreferencesByCommittee: body.portfolioPreferencesByCommittee as
        | Record<string, string[]>
        | undefined,
      formAnswers: (body.formAnswers || {}) as Record<string, string | number | boolean | string[]>,
      pricingPhaseId: pricing.phaseId,
      pricingPhaseName: pricing.phaseName,
      status: (result.paid ? "Confirmed" : "Pending") as "Confirmed" | "Pending",
      registeredAt,
      paid: result.paid,
      amount: result.amount,
      userEmail: actor.email,
      organizerStatus:
        result.paid ? ("Allotted" as const) : ("Pending" as const),
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
    const message = error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
