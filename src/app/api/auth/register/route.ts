import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { hashPassword, validateNewPassword } from "@/lib/server/password";
import { signSessionToken } from "@/lib/server/session-token";
import { prismaUserRoleToSession } from "@/lib/server/user-role";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const role = body.role === "organizer" ? "organizer" : "delegate";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    const passwordError = validateNewPassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role === "organizer" ? "ORGANIZER" : "DELEGATE",
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, sessionVersion: true },
    });

    const sessionRole = prismaUserRoleToSession(user.role);
    const token = await signSessionToken({
      email: user.email,
      role: sessionRole,
      name: user.name,
      sub: user.id,
      sv: user.sessionVersion,
    });
    const response = NextResponse.json({
      ok: true,
      name: user.name,
      role: sessionRole,
    });
    response.cookies.set("mymun_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not register account." }, { status: 400 });
  }
}
