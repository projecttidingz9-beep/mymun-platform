import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { prismaUserToClientUser } from "@/lib/server/map-db-user";
import { prisma } from "@/lib/server/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = String(params.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      registrations: {
        where: { deletedAt: null },
        include: { event: { select: { title: true } } },
      },
    },
  });

  if (!user || user.deletedAt) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const profile =
    user.delegateProfile && typeof user.delegateProfile === "object"
      ? (user.delegateProfile as Record<string, unknown>)
      : {};
  const visibility = profile.profileVisibility === "private" ? "private" : "public";

  const actor = await getRequestActor(request);
  const viewerId = await resolveActorUserId(actor);

  if (visibility === "private" && viewerId !== user.id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({ user: prismaUserToClientUser(user) });
}
