import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { getRequestActor } from "@/lib/server/auth";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";

/** Submit a delegate review for a published conference (pending moderation). */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (actor.role === "organizer") {
    return NextResponse.json({ error: "Organizers cannot submit delegate reviews." }, { status: 403 });
  }

  const verifyBlock = await requireVerifiedEmail(actor);
  if (verifyBlock) return verifyBlock;

  const params = await context.params;
  const eventKey = String(params.eventId || "").trim();
  if (!eventKey) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rating = Number(body.rating);
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }
  if (!comment) {
    return NextResponse.json({ error: "Review comment is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const event = await prisma.event.findFirst({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      OR: [{ id: eventKey }, { slug: eventKey }],
    },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Conference not found." }, { status: 404 });
  }

  const registration = await prisma.registration.findFirst({
    where: {
      eventId: event.id,
      userId: user.id,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!registration) {
    return NextResponse.json(
      { error: "You must register for this conference before submitting a review." },
      { status: 403 }
    );
  }

  const existing = await prisma.conferenceReview.findUnique({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId: user.id,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "You have already submitted a review for this conference." }, { status: 409 });
  }

  const review = await prisma.conferenceReview.create({
    data: {
      id: `review-${randomUUID()}`,
      eventId: event.id,
      userId: user.id,
      rating: Math.round(rating),
      comment,
      status: "pending",
      featured: false,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    review: {
      id: review.id,
      userName: user.name,
      rating: review.rating,
      comment: review.comment ?? "",
      status: review.status,
      createdAt: review.createdAt.toISOString(),
    },
  });
}
