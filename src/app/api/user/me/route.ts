import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getRequestActor } from "@/lib/server/auth";
import { loadClientUserByEmail } from "@/lib/server/load-client-user";
import { logger } from "@/lib/server/logger";
import { prismaUserToClientUser } from "@/lib/server/map-db-user";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const user = await loadClientUserByEmail(actor.email);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    logger.error("user_me_failed", {
      email: actor.email,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "Could not load your profile. The server may need a database update.",
        code: "USER_ME_FAILED",
      },
      { status: 500 }
    );
  }
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
