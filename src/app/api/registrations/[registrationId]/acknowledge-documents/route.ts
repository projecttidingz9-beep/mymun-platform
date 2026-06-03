import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { requireRegistrationOwner } from "@/lib/server/require-registration-owner";
import { resolveCommitteeIdFromRegistration } from "@/lib/server/resolve-event-committee";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "").trim();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const registration = await requireRegistrationOwner(actor, registrationId);
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const committeeId = await resolveCommitteeIdFromRegistration(registration);
  if (!committeeId) {
    return NextResponse.json(
      { error: "No committee assigned yet. Documents are available after allotment." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { documentIds?: unknown };
  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds must be a non-empty array." }, { status: 400 });
  }

  const documents = await prisma.committeeDocument.findMany({
    where: { id: { in: documentIds }, committeeId },
    select: { id: true },
  });

  if (documents.length !== documentIds.length) {
    return NextResponse.json(
      { error: "One or more documents were not found for your assigned committee." },
      { status: 400 }
    );
  }

  const acknowledged = await prisma.$transaction(
    documentIds.map((documentId) =>
      prisma.documentAcknowledgment.upsert({
        where: { registrationId_documentId: { registrationId, documentId } },
        create: { registrationId, documentId },
        update: { acknowledgedAt: new Date() },
        select: { id: true, documentId: true, acknowledgedAt: true },
      })
    )
  );

  return NextResponse.json({
    ok: true,
    acknowledgments: acknowledged.map((entry) => ({
      id: entry.id,
      documentId: entry.documentId,
      acknowledgedAt: entry.acknowledgedAt.toISOString(),
    })),
  });
}
