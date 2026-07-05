import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { prisma } from "@/lib/server/prisma";
import { requireRegistrationOwner } from "@/lib/server/require-registration-owner";

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

  const papers = await prisma.positionPaper.findMany({
    where: { registrationId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      committeeId: true,
      fileUrl: true,
      textContent: true,
      status: true,
      reviewerNotes: true,
      submittedAt: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({
    papers: papers.map((paper) => ({
      id: paper.id,
      committeeId: paper.committeeId,
      fileUrl: paper.fileUrl,
      textContent: paper.textContent,
      status: paper.status,
      reviewerNotes: paper.reviewerNotes,
      submittedAt: paper.submittedAt.toISOString(),
      reviewedAt: paper.reviewedAt?.toISOString() ?? null,
    })),
  });
}

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

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const committeeId = String(body.committeeId || "").trim();
    const textContent =
      typeof body.textContent === "string" ? body.textContent.trim() : "";
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";

    if (!committeeId) {
      return NextResponse.json({ error: "committeeId is required." }, { status: 400 });
    }
    if (!textContent && !fileUrl) {
      return NextResponse.json(
        { error: "Provide textContent or fileUrl for the position paper." },
        { status: 400 }
      );
    }

    const committee = await prisma.committeeConfig.findFirst({
      where: {
        id: committeeId,
        organizerConfig: { eventId: registration.eventId },
      },
      select: { id: true },
    });
    if (!committee) {
      return NextResponse.json({ error: "Committee not found for this conference." }, { status: 400 });
    }

    const paper = await prisma.positionPaper.upsert({
      where: {
        registrationId_committeeId: { registrationId, committeeId },
      },
      create: {
        registrationId,
        eventId: registration.eventId,
        committeeId,
        textContent: textContent || null,
        fileUrl: fileUrl || null,
        status: "PENDING",
      },
      update: {
        textContent: textContent || null,
        fileUrl: fileUrl || null,
        status: "PENDING",
        submittedAt: new Date(),
        reviewedAt: null,
        reviewerNotes: null,
      },
      select: {
        id: true,
        committeeId: true,
        status: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      paper: {
        id: paper.id,
        committeeId: paper.committeeId,
        status: paper.status,
        submittedAt: paper.submittedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error("position_paper_submit_failed", {
      registrationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not submit position paper." }, { status: 500 });
  }
}
