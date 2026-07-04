import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

/**
 * Invoice metadata for a paid registration owned by the caller.
 * When an admin has uploaded a per-conference invoice template, return that URL;
 * otherwise the client generates a standard PDF.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  const actorUserId = await resolveActorUserId(actor);
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "").trim();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId: actorUserId, deletedAt: null },
    select: {
      id: true,
      paid: true,
      amount: true,
      event: {
        select: {
          title: true,
          currency: true,
          organizerConfig: {
            select: {
              invoiceTemplateUrl: true,
              invoiceTemplateFileName: true,
            },
          },
        },
      },
    },
  });

  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (!registration.paid) {
    return NextResponse.json({ error: "Invoice is available after payment." }, { status: 403 });
  }

  const templateUrl = registration.event.organizerConfig?.invoiceTemplateUrl?.trim() || null;
  const templateFileName =
    registration.event.organizerConfig?.invoiceTemplateFileName?.trim() || null;

  return NextResponse.json({
    registrationId: registration.id,
    paid: true,
    amount: registration.amount,
    currency: registration.event.currency,
    conferenceTitle: registration.event.title,
    templateUrl,
    templateFileName,
  });
}
