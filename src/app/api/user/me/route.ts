import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getRequestActor } from "@/lib/server/auth";
import { prismaUserToClientUser } from "@/lib/server/map-db-user";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    include: {
      registrations: {
        where: { deletedAt: null },
        include: { event: { select: { title: true } } },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ user: prismaUserToClientUser(user) });
}

export async function PATCH(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true, delegateProfile: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const nextProfile =
    user.delegateProfile && typeof user.delegateProfile === "object"
      ? ({ ...(user.delegateProfile as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const profileKeys = [
    "profileImageUrl",
    "firstName",
    "lastName",
    "school",
    "college",
    "fieldOfStudy",
    "profileHeadline",
    "phone",
    "city",
    "state",
    "postalCode",
    "country",
    "munExperienceSummary",
    "munAwardsSummary",
    "munParticipations",
    "munAwards",
    "profileVisibility",
    "socialMedia",
    "invoiceAddress",
    "avatar",
  ] as const;

  for (const key of profileKeys) {
    if (body[key] !== undefined) {
      nextProfile[key] = body[key];
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim() } : {}),
      delegateProfile: nextProfile as Prisma.InputJsonValue,
    },
    include: {
      registrations: {
        where: { deletedAt: null },
        include: { event: { select: { title: true } } },
      },
    },
  });

  return NextResponse.json({ user: prismaUserToClientUser(updated) });
}
