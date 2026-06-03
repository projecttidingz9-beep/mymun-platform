import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { requireRegistrationOwner } from "@/lib/server/require-registration-owner";
import { resolveCommitteeIdFromRegistration } from "@/lib/server/resolve-event-committee";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(_request);
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
    return NextResponse.json({
      committeeId: null,
      committeeName: registration.committeeName,
      documents: [],
    });
  }

  const [committee, documents, acknowledgments] = await Promise.all([
    prisma.committeeConfig.findUnique({
      where: { id: committeeId },
      select: { id: true, name: true },
    }),
    prisma.committeeDocument.findMany({
      where: { committeeId },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.documentAcknowledgment.findMany({
      where: { registrationId },
      select: { documentId: true, acknowledgedAt: true },
    }),
  ]);

  const ackByDocumentId = new Map(
    acknowledgments.map((entry) => [entry.documentId, entry.acknowledgedAt])
  );

  return NextResponse.json({
    committeeId: committee?.id ?? committeeId,
    committeeName: committee?.name ?? registration.committeeName,
    documents: documents.map((doc) => {
      const acknowledgedAt = ackByDocumentId.get(doc.id);
      return {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        fileUrl: doc.fileUrl,
        version: doc.version,
        publishedAt: doc.publishedAt.toISOString(),
        acknowledged: Boolean(acknowledgedAt),
        acknowledgedAt: acknowledgedAt?.toISOString() ?? null,
      };
    }),
  });
}
