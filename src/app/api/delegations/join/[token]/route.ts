import { NextRequest, NextResponse } from "next/server";
import { DelegationStatus } from "@/generated/prisma/enums";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

async function findDelegationByToken(token: string) {
  return prisma.delegation.findUnique({
    where: { inviteToken: token },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      },
      owner: { select: { id: true, name: true } },
      members: {
        select: {
          id: true,
          userId: true,
          joinedAt: true,
          user: { select: { name: true } },
        },
      },
      _count: { select: { members: true, registrations: true } },
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const params = await context.params;
  const token = String(params.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Invite token is required." }, { status: 400 });
  }

  const delegation = await findDelegationByToken(token);
  if (!delegation) {
    return NextResponse.json({ error: "Delegation invite not found." }, { status: 404 });
  }

  return NextResponse.json({
    delegation: {
      id: delegation.id,
      schoolName: delegation.schoolName,
      name: delegation.name,
      status: delegation.status,
      maxMembers: delegation.maxMembers,
      memberCount: delegation._count.members + 1,
      ownerName: delegation.owner.name,
    },
    event: {
      id: delegation.event.id,
      title: delegation.event.title,
      startDate: delegation.event.startDate.toISOString(),
      endDate: delegation.event.endDate.toISOString(),
      status: delegation.event.status,
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await resolveActorUserId(actor);
  if (!userId) {
    return NextResponse.json({ error: "User profile not found. Sign in again." }, { status: 400 });
  }

  const params = await context.params;
  const token = String(params.token || "").trim();
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
    },
  });

  if (!delegation) {
    return NextResponse.json({ error: "Delegation invite not found." }, { status: 404 });
  }

  if (delegation.status !== DelegationStatus.OPEN) {
    return NextResponse.json({ error: "This delegation is closed." }, { status: 409 });
  }

  if (delegation.ownerUserId === userId) {
    return NextResponse.json({ error: "You are already the delegation owner." }, { status: 409 });
  }

  const existingMember = await prisma.delegationMember.findUnique({
    where: { delegationId_userId: { delegationId: delegation.id, userId } },
    select: { id: true },
  });
  if (existingMember) {
    return NextResponse.json({ error: "You have already joined this delegation." }, { status: 409 });
  }

  if (delegation.maxMembers !== null) {
    const memberCount = await prisma.delegationMember.count({
      where: { delegationId: delegation.id },
    });
    if (memberCount + 1 >= delegation.maxMembers) {
      return NextResponse.json({ error: "This delegation is full." }, { status: 409 });
    }
  }

  const member = await prisma.delegationMember.create({
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

  return NextResponse.json({
    ok: true,
    member,
    delegation: {
      id: delegation.id,
      schoolName: delegation.schoolName,
      eventId: delegation.eventId,
    },
  });
}
