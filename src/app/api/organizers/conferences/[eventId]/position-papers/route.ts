import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "").trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  const statusFilter = new URL(request.url).searchParams.get("status")?.trim().toUpperCase();
  const committeeId = new URL(request.url).searchParams.get("committeeId")?.trim();

  const papers = await prisma.positionPaper.findMany({
    where: {
      eventId,
      ...(statusFilter === "PENDING" ||
      statusFilter === "APPROVED" ||
      statusFilter === "REJECTED"
        ? { status: statusFilter }
        : {}),
      ...(committeeId ? { committeeId } : {}),
    },
    include: {
      committee: { select: { id: true, name: true } },
      registration: {
        select: {
          id: true,
          committeeName: true,
          portfolioName: true,
          status: true,
          paid: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({
    positionPapers: papers.map((paper) => ({
      id: paper.id,
      registrationId: paper.registrationId,
      committeeId: paper.committeeId,
      committeeName: paper.committee.name,
      textContent: paper.textContent,
      fileUrl: paper.fileUrl,
      status: paper.status,
      reviewerNotes: paper.reviewerNotes,
      submittedAt: paper.submittedAt.toISOString(),
      reviewedAt: paper.reviewedAt?.toISOString() ?? null,
      registration: paper.registration,
    })),
  });
}
