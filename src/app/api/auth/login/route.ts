import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/password";
import { signSessionToken } from "@/lib/server/session-token";
import { prismaUserRoleToSession } from "@/lib/server/user-role";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !email.includes("@") || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        deletedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        sessionVersion: true,
      },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Account temporarily locked after too many attempts. Try again later." },
        { status: 423 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Password is not set for this account. Please use forgot password." },
        { status: 400 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const nextAttempts = user.failedLoginAttempts + 1;
      const forwarded = request.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || undefined;

      if (nextAttempts >= MAX_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: new Date(Date.now() + LOCK_MS),
          },
        });
        await prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "LOGIN_LOCKOUT",
            entity: "User",
            entityId: user.id,
            after: { reason: "too_many_failed_attempts", ip },
          },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: nextAttempts },
        });
      }

      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const role = prismaUserRoleToSession(user.role);
    const token = await signSessionToken({
      email: user.email,
      role,
      name: user.name,
      sub: user.id,
      sv: user.sessionVersion,
    });
    const response = NextResponse.json({ ok: true, name: user.name, role });
    response.cookies.set("mymun_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 400 });
  }
}
