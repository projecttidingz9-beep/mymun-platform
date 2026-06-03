import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/password";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { getClientIp } from "@/lib/server/request-ip";
import { loadClientUserByEmail } from "@/lib/server/load-client-user";
import { logger } from "@/lib/server/logger";
import { setMymunSessionCookie } from "@/lib/server/oauth-bridge";
import { signSessionToken } from "@/lib/server/session-token";
import { prismaUserRoleToSession } from "@/lib/server/user-role";
import { loginBodySchema } from "@/lib/server/validators/auth";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const loginBurstOk = await consumeRateLimitBucket({
      key: `auth:login:${ip}`,
      windowMs: 60 * 1000,
      limit: 30,
    });
    if (!loginBurstOk) {
      return NextResponse.json({ error: "Too many login attempts. Wait a minute." }, { status: 429 });
    }

    const raw = await request.json();
    const parsed = loginBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const password = parsed.data.password;

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
    const clientUser = await loadClientUserByEmail(user.email);
    const response = NextResponse.json({
      ok: true,
      name: user.name,
      role,
      user: clientUser,
    });
    setMymunSessionCookie(response, token);
    return response;
  } catch (err) {
    logger.error("auth_login_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not sign in. Please try again.", code: "AUTH_LOGIN_FAILED" },
      { status: 500 }
    );
  }
}
