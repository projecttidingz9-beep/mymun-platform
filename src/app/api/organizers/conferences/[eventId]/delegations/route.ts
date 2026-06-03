import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(_request);
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

  const delegations = await prisma.delegation.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      registrations: {
        where: { deletedAt: null },
        select: {
          id: true,
          userId: true,
          paid: true,
          status: true,
          committeeName: true,
          portfolioName: true,
          isDelegationHead: true,
        },
      },
    },
  });

  return NextResponse.json({
    delegations: delegations.map((delegation) => ({
      id: delegation.id,
      inviteToken: delegation.inviteToken,
      schoolName: delegation.schoolName,
      name: delegation.name,
      status: delegation.status,
      maxMembers: delegation.maxMembers,
      createdAt: delegation.createdAt.toISOString(),
      owner: delegation.owner,
      members: delegation.members.map((member) => {
        const registration =
          delegation.registrations.find((entry) => entry.userId === member.userId) || null;
        return {
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
          user: member.user,
          registration,
        };
      }),
      ownerRegistration:
        delegation.registrations.find((entry) => entry.userId === delegation.ownerUserId) || null,
      memberCount: delegation.members.length + 1,
    })),
  });
}
