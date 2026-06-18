import { NextRequest, NextResponse } from "next/server";
import { PositionPaperStatus } from "@/generated/prisma/enums";
import { getRequestActor } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { prisma } from "@/lib/server/prisma";
import { requireRegistrationOwner } from "@/lib/server/require-registration-owner";
import { resolveCommitteeForEvent } from "@/lib/server/resolve-event-committee";

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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const committeeId = String(body.committeeId || "").trim();
  const textContent =
    typeof body.textContent === "string" ? body.textContent.trim() || null : null;
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() || null : null;

  if (!committeeId) {
    return NextResponse.json({ error: "committeeId is required." }, { status: 400 });
  }
  if (!textContent && !fileUrl) {
    return NextResponse.json(
      { error: "Provide textContent or fileUrl for the position paper." },
      { status: 400 }
    );
  }

  const committee = await resolveCommitteeForEvent(registration.eventId, committeeId);
  if (!committee) {
    return NextResponse.json({ error: "Committee not found for this conference." }, { status: 400 });
  }

  try {
    const paper = await prisma.positionPaper.upsert({
      where: {
        registrationId_committeeId: { registrationId, committeeId },
      },
      create: {
        registrationId,
        eventId: registration.eventId,
        committeeId,
        textContent,
        fileUrl,
        status: PositionPaperStatus.PENDING,
        submittedAt: new Date(),
      },
      update: {
        textContent,
        fileUrl,
        status: PositionPaperStatus.PENDING,
        reviewerNotes: null,
        reviewedAt: null,
        submittedAt: new Date(),
      },
      select: {
        id: true,
        committeeId: true,
        textContent: true,
        fileUrl: true,
        status: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({ ok: true, positionPaper: paper });
  } catch (error) {
    logger.error("position_paper_submit_failed", {
      registrationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not submit position paper." }, { status: 500 });
  }
}

export async function GET(
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

  const committeeId = new URL(request.url).searchParams.get("committeeId")?.trim();

  const papers = await prisma.positionPaper.findMany({
    where: {
      registrationId,
      ...(committeeId ? { committeeId } : {}),
    },
    include: {
      committee: { select: { id: true, name: true, positionPaperDeadline: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  if (committeeId && papers.length === 0) {
    return NextResponse.json({ error: "Position paper not found." }, { status: 404 });
  }

  return NextResponse.json({
    positionPapers: papers.map((paper) => ({
      id: paper.id,
      committeeId: paper.committeeId,
      committeeName: paper.committee.name,
      textContent: paper.textContent,
      fileUrl: paper.fileUrl,
      status: paper.status,
      reviewerNotes: paper.reviewerNotes,
      submittedAt: paper.submittedAt.toISOString(),
      reviewedAt: paper.reviewedAt?.toISOString() ?? null,
      deadline: paper.committee.positionPaperDeadline?.toISOString() ?? null,
    })),
  });
}
