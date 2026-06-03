import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
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
    select: { id: true, eventId: true, event: { select: { startDate: true } } },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (!(await requireEventOrganizerAccess(actor, registration.eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

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

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      ...(statusDb !== undefined ? { status: statusDb } : {}),
      ...(committeeName !== undefined ? { committeeName } : {}),
      ...(portfolioName !== undefined ? { portfolioName } : {}),
      ...(paid !== undefined ? { paid } : {}),
      ...(nextAllottedAt !== undefined ? { allottedAt: nextAllottedAt } : {}),
    },
  });

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
