import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { hashPassword, validateNewPassword } from "@/lib/server/password";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { getClientIp } from "@/lib/server/request-ip";
import { hashResetToken } from "@/lib/server/reset-token";
import { resetPasswordBodySchema } from "@/lib/server/validators/auth";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ok = await consumeRateLimitBucket({
      key: `auth:reset:${ip}`,
      windowMs: 60 * 60 * 1000,
      limit: 20,
    });
    if (!ok) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const raw = await request.json();
    const parsed = resetPasswordBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { token, newPassword } = parsed.data;

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const tokenHash = hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });
    if (!resetToken) {
      return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, deletedAt: null },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not reset password." }, { status: 400 });
  }
}
