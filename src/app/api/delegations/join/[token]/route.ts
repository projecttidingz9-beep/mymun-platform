import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { DelegationStatus } from "@/generated/prisma/enums";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { normalizeDelegationCode } from "@/lib/delegation-code";
import { getDelegationInviteByToken } from "@/lib/server/delegation-invite";
import { logger } from "@/lib/server/logger";
import { prisma } from "@/lib/server/prisma";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { requireVerifiedEmail } from "@/lib/server/require-verified-email";
import { getClientIp } from "@/lib/server/request-ip";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const previewAllowed = await consumeRateLimitBucket({
    key: `delegation:preview:${getClientIp(_request)}`,
    windowMs: 60_000,
    limit: 30,
  });
  if (!previewAllowed) {
    return NextResponse.json({ error: "Too many code lookups. Wait a minute." }, { status: 429 });
  }
  const params = await context.params;
  const token = normalizeDelegationCode(String(params.token || ""));
  const { info, error } = await getDelegationInviteByToken(token);
  if (error) {
    const status = error === "Invite token is required." ? 400 : 404;
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(info);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (actor.role === "organizer") {
    return NextResponse.json({ error: "Organizer accounts cannot join delegations." }, { status: 403 });
  }
  const verifyBlock = await requireVerifiedEmail(actor);
  if (verifyBlock) return verifyBlock;

  const userId = await resolveActorUserId(actor);
  if (!userId) {
    return NextResponse.json({ error: "User profile not found. Sign in again." }, { status: 400 });
  }
  const joinAllowed = await consumeRateLimitBucket({
    key: `delegation:join:${userId}`,
    windowMs: 60_000,
    limit: 10,
  });
  if (!joinAllowed) {
    return NextResponse.json({ error: "Too many join attempts. Wait a minute." }, { status: 429 });
  }

  const params = await context.params;
  const token = normalizeDelegationCode(String(params.token || ""));
  if (!token) {
    return NextResponse.json({ error: "Invite token is required." }, { status: 400 });
  }

  const delegation = await prisma.delegation.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      eventId: true,
      status: true,
      maxMembers: true,
      ownerUserId: true,
      schoolName: true,
      event: { select: { status: true, endDate: true } },
    },
  });

  if (!delegation) {
    return NextResponse.json({ error: "Delegation invite not found." }, { status: 404 });
  }

  if (delegation.status !== DelegationStatus.OPEN) {
    return NextResponse.json({ error: "This delegation is closed." }, { status: 409 });
  }
  if (delegation.event.status !== "PUBLISHED" || delegation.event.endDate.getTime() < Date.now()) {
    return NextResponse.json({ error: "This conference is not open for registration." }, { status: 409 });
  }

  if (delegation.ownerUserId === userId) {
    return NextResponse.json({ error: "You are already the delegation owner." }, { status: 409 });
  }

  try {
    const member = await prisma.$transaction(
      async (tx) => {
        const currentDelegation = await tx.delegation.findUnique({
          where: { id: delegation.id },
          select: { status: true, maxMembers: true },
        });
        if (!currentDelegation || currentDelegation.status !== DelegationStatus.OPEN) {
          throw new Error("DELEGATION_CLOSED");
        }
        const existingMember = await tx.delegationMember.findUnique({
          where: { delegationId_userId: { delegationId: delegation.id, userId } },
          select: { id: true },
        });
        if (existingMember) {
          throw new Error("ALREADY_MEMBER");
        }

        const otherDelegation = await tx.delegation.findFirst({
          where: {
            eventId: delegation.eventId,
            id: { not: delegation.id },
            OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
          },
          select: { id: true },
        });
        if (otherDelegation) {
          throw new Error("ALREADY_IN_OTHER_DELEGATION");
        }

        const existingRegistration = await tx.registration.findFirst({
          where: { userId, eventId: delegation.eventId, deletedAt: null },
          select: { id: true, delegationId: true, categoryId: true },
        });
        if (existingRegistration?.delegationId && existingRegistration.delegationId !== delegation.id) {
          throw new Error("REGISTRATION_IN_OTHER_DELEGATION");
        }
        if (existingRegistration && !existingRegistration.delegationId) {
          const delegationCategory = existingRegistration.categoryId
            ? await tx.registrationCategoryConfig.findFirst({
                where: {
                  categoryKey: existingRegistration.categoryId,
                  applicationType: "delegation",
                  organizerConfig: { eventId: delegation.eventId },
                },
                select: { id: true },
              })
            : null;
          if (!delegationCategory) throw new Error("NON_DELEGATION_REGISTRATION");
        }

        if (currentDelegation.maxMembers !== null) {
          const memberCount = await tx.delegationMember.count({
            where: { delegationId: delegation.id },
          });
          if (memberCount + 1 >= currentDelegation.maxMembers) {
            throw new Error("DELEGATION_FULL");
          }
        }

        const created = await tx.delegationMember.create({
          data: {
            delegationId: delegation.id,
            userId,
            role: "member",
          },
          select: {
            id: true,
            delegationId: true,
            userId: true,
            role: true,
            joinedAt: true,
          },
        });
        if (existingRegistration && !existingRegistration.delegationId) {
          await tx.registration.update({
            where: { id: existingRegistration.id },
            data: { delegationId: delegation.id, isDelegationHead: false },
          });
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({
      ok: true,
      member,
      delegation: {
        id: delegation.id,
        code: token,
        schoolName: delegation.schoolName,
        eventId: delegation.eventId,
        isHead: false,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ALREADY_MEMBER") {
        return NextResponse.json(
          { error: "You have already joined this delegation." },
          { status: 409 }
        );
      }
      if (error.message === "DELEGATION_FULL") {
        return NextResponse.json({ error: "This delegation is full." }, { status: 409 });
      }
      if (error.message === "DELEGATION_CLOSED") {
        return NextResponse.json({ error: "This delegation is closed." }, { status: 409 });
      }
      if (
        error.message === "ALREADY_IN_OTHER_DELEGATION" ||
        error.message === "REGISTRATION_IN_OTHER_DELEGATION"
      ) {
        return NextResponse.json(
          { error: "You already belong to another delegation for this conference." },
          { status: 409 }
        );
      }
      if (error.message === "NON_DELEGATION_REGISTRATION") {
        return NextResponse.json(
          {
            error:
              "You already registered for this conference outside a delegation. Withdraw that registration before joining a team.",
          },
          { status: 409 }
        );
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "You have already joined this delegation." },
          { status: 409 }
        );
      }
      if (error.code === "P2034") {
        return NextResponse.json(
          { error: "Delegation capacity changed. Please retry." },
          { status: 409 }
        );
      }
    }
    logger.error("delegation_join_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not join delegation." }, { status: 500 });
  }
}
