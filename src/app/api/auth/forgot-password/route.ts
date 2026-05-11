import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { getClientIp } from "@/lib/server/request-ip";
import { resolvePublicOrigin } from "@/lib/server/public-origin";
import { createPasswordResetToken } from "@/lib/server/reset-token";
import { forgotPasswordBodySchema } from "@/lib/server/validators/auth";

const RESET_TOKEN_TTL_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const raw = await request.json();
    const parsed = forgotPasswordBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();

    const ipOk = await consumeRateLimitBucket({
      key: `auth:forgot:${ip}`,
      windowMs: 60 * 60 * 1000,
      limit: 10,
    });
    const emailOk = await consumeRateLimitBucket({
      key: `auth:forgot:email:${email}`,
      windowMs: 60 * 60 * 1000,
      limit: 5,
    });
    if (!ipOk || !emailOk) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return NextResponse.json({ ok: true });
    }

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
      },
    });

    const { rawToken, tokenHash } = createPasswordResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const publicOrigin = resolvePublicOrigin(request);
    const resetUrl = `${publicOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
    const hasResend = Boolean(apiKey && fromEmail);

    if (hasResend) {
      try {
        const resend = new Resend(apiKey!);
        await resend.emails.send({
          from: fromEmail!,
          to: user.email,
          subject: "Reset your Tidingz password",
          text:
            `Hi ${user.name},\n\n` +
            `Use this link to reset your password (valid for ${RESET_TOKEN_TTL_MINUTES} minutes):\n` +
            `${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        });
        logger.info("password_reset_email_sent", { userId: user.id });
      } catch (sendErr) {
        logger.error("password_reset_email_send_failed", {
          userId: user.id,
          error: sendErr instanceof Error ? sendErr.message : String(sendErr),
        });
        return NextResponse.json(
          {
            error: "Could not send reset email. Please try again later.",
            code: "email_send_failed",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (process.env.NODE_ENV === "production") {
      logger.error("password_reset_email_misconfigured", { userId: user.id });
      return NextResponse.json(
        {
          error:
            "Password reset email is not configured on this server. Please contact support or try again later.",
          code: "email_not_configured",
        },
        { status: 503 }
      );
    }

    logger.warn("password_reset_email_skipped_no_resend", { userId: user.id });
    return NextResponse.json({ ok: true, devResetUrl: resetUrl });
  } catch (err) {
    logger.error("forgot_password_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "Could not process password reset. Please try again.",
        code: "FORGOT_PASSWORD_FAILED",
      },
      { status: 500 }
    );
  }
}
