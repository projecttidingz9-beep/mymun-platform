import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { hashPassword, validateNewPassword } from "@/lib/server/password";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { getClientIp } from "@/lib/server/request-ip";
import { signSessionToken } from "@/lib/server/session-token";
import { prismaUserRoleToSession } from "@/lib/server/user-role";
import { registerBodySchema } from "@/lib/server/validators/auth";
import { logger } from "@/lib/server/logger";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ok = await consumeRateLimitBucket({
      key: `auth:register:${ip}`,
      windowMs: 60 * 60 * 1000,
      limit: 15,
    });
    if (!ok) {
      return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
    }

    const raw = await request.json();
    const parsed = registerBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { email: emailRaw, password, name, role: roleRaw } = parsed.data;
    const email = emailRaw.toLowerCase();
    const role = roleRaw === "organizer" ? "organizer" : "delegate";

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
  } catch (err) {
    logger.error("auth_register_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not register account. Please try again.", code: "AUTH_REGISTER_FAILED" },
      { status: 500 }
    );
  }
}
