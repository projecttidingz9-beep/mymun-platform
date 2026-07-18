import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { generateDelegationCode } from "@/lib/server/delegation-code";
import { prisma } from "@/lib/server/prisma";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const userId = await resolveActorUserId(actor);
  const eventId = request.nextUrl.searchParams.get("eventId")?.trim() || "";
  if (!userId || !eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const delegation = await prisma.delegation.findFirst({
    where: {
      eventId,
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      inviteToken: true,
      name: true,
      schoolName: true,
      maxMembers: true,
      status: true,
      ownerUserId: true,
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({
    delegation: delegation
      ? {
          id: delegation.id,
          code: delegation.inviteToken,
          name: delegation.name,
          schoolName: delegation.schoolName,
          maxMembers: delegation.maxMembers,
          memberCount: delegation._count.members + 1,
          status: delegation.status,
          isHead: delegation.ownerUserId === userId,
        }
      : null,
  });
}

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (actor.role === "organizer") {
    return NextResponse.json({ error: "Organizer accounts cannot create delegations." }, { status: 403 });
  }
  const verifyBlock = await requireVerifiedEmail(actor);
  if (verifyBlock) return verifyBlock;

  const ownerUserId = await resolveActorUserId(actor);
  if (!ownerUserId) {
    return NextResponse.json({ error: "User profile not found. Sign in again." }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const eventId = String(body.eventId || "").trim();
    const schoolName = String(body.schoolName || "").trim();
    const maxMembersRaw = body.maxMembers;
    const registrationId =
      typeof body.registrationId === "string" ? body.registrationId.trim() : undefined;

    if (!eventId || !schoolName) {
      return NextResponse.json({ error: "eventId and schoolName are required." }, { status: 400 });
    }

    const maxMembers =
      maxMembersRaw === undefined || maxMembersRaw === null
        ? null
        : Number(maxMembersRaw);
    if (maxMembers !== null && (!Number.isFinite(maxMembers) || maxMembers < 1)) {
      return NextResponse.json({ error: "maxMembers must be a positive number." }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null, status: "PUBLISHED" },
      select: {
        id: true,
        endDate: true,
        organizerConfig: {
          select: {
            registrationCategories: {
              where: { applicationType: "delegation", isOpen: true },
              select: { maxDelegatesPerDelegation: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Conference is not open for delegation registration." }, { status: 404 });
    }
    if (event.endDate.getTime() < Date.now()) {
      return NextResponse.json({ error: "This conference has ended." }, { status: 409 });
    }
    if (!event.organizerConfig?.registrationCategories.length) {
      return NextResponse.json(
        { error: "Delegation registration is not open for this conference." },
        { status: 409 }
      );
    }
    const categoryMax =
      event.organizerConfig?.registrationCategories[0]?.maxDelegatesPerDelegation ?? null;
    if (categoryMax !== null && maxMembers !== null && maxMembers > categoryMax) {
      return NextResponse.json(
        { error: `This conference allows at most ${categoryMax} students per delegation.` },
        { status: 400 }
      );
    }
    const effectiveMaxMembers = maxMembers ?? categoryMax;

    if (registrationId) {
      const registration = await prisma.registration.findFirst({
        where: { id: registrationId, userId: ownerUserId, eventId, deletedAt: null },
        select: { id: true, delegationId: true },
      });
      if (!registration) {
        return NextResponse.json(
          { error: "Registration not found or does not belong to you for this conference." },
          { status: 404 }
        );
      }
      if (registration.delegationId) {
        return NextResponse.json(
          { error: "Registration is already linked to a delegation." },
          { status: 409 }
        );
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteToken = generateDelegationCode();
      try {
        const delegation = await prisma.$transaction(
          async (tx) => {
            const existing = await tx.delegation.findFirst({
              where: {
                eventId,
                OR: [{ ownerUserId }, { members: { some: { userId: ownerUserId } } }],
              },
              select: { id: true },
            });
            if (existing) throw new Error("ALREADY_IN_DELEGATION");
            const existingRegistration = await tx.registration.findFirst({
              where: { userId: ownerUserId, eventId, deletedAt: null },
              select: { id: true, categoryId: true, delegationId: true },
            });
            if (existingRegistration?.delegationId) throw new Error("ALREADY_IN_DELEGATION");
            if (existingRegistration) {
              const delegationCategory = existingRegistration.categoryId
                ? await tx.registrationCategoryConfig.findFirst({
                    where: {
                      categoryKey: existingRegistration.categoryId,
                      applicationType: "delegation",
                      organizerConfig: { eventId },
                    },
                    select: { id: true },
                  })
                : null;
              if (!delegationCategory) throw new Error("NON_DELEGATION_REGISTRATION");
            }

            const created = await tx.delegation.create({
              data: {
                eventId,
                inviteToken,
                schoolName,
                name: schoolName,
                maxMembers: effectiveMaxMembers,
                ownerUserId,
              },
              select: {
                id: true,
                inviteToken: true,
                schoolName: true,
                maxMembers: true,
                status: true,
                createdAt: true,
              },
            });

            const registrationToLink = registrationId || existingRegistration?.id;
            if (registrationToLink) {
              await tx.registration.update({
                where: { id: registrationToLink },
                data: { delegationId: created.id, isDelegationHead: true },
              });
            }

            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return NextResponse.json({
          ok: true,
          delegation: {
            ...delegation,
            code: delegation.inviteToken,
            memberCount: 1,
            isHead: true,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message === "ALREADY_IN_DELEGATION") {
          return NextResponse.json(
            { error: "You already belong to a delegation for this conference." },
            { status: 409 }
          );
        }
        if (error instanceof Error && error.message === "NON_DELEGATION_REGISTRATION") {
          return NextResponse.json(
            {
              error:
                "You already registered for this conference outside a delegation. Withdraw that registration before creating a team.",
            },
            { status: 409 }
          );
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034")
        ) {
          if (error.code === "P2002" && attempt < 4) continue;
          return NextResponse.json(
            { error: "Delegation details changed. Please retry." },
            { status: 409 }
          );
        }
        throw error;
      }
    }
    return NextResponse.json({ error: "Could not generate a unique delegation code." }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Failed to create delegation." }, { status: 500 });
  }
}
