import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, resolveActorUserId } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { signSessionToken } from "@/lib/server/session-token";
import { prismaUserRoleToSession } from "@/lib/server/user-role";

/** Return current session + DB user id (if the user row exists). */
export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const userId = await resolveActorUserId(actor);
  return NextResponse.json({
    actor: { email: actor.email, role: actor.role, name: actor.name, userId },
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Active session required." }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: actor.email },
      select: { id: true, email: true, name: true, role: true, sessionVersion: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 401 });
    }
    const token = await signSessionToken({
      email: user.email,
      role: prismaUserRoleToSession(user.role),
      name: user.name,
      sub: user.id,
      sv: user.sessionVersion,
    });

    const response = NextResponse.json({ ok: true, role: actor.role });
    response.cookies.set("mymun_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not establish session." }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mymun_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
