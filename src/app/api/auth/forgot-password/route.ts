import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/server/prisma";
import { createPasswordResetToken } from "@/lib/server/reset-token";

const RESET_TOKEN_TTL_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
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

    const resetUrl = `${request.nextUrl.origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (apiKey && fromEmail) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: "Reset your MyMUN password",
        text:
          `Hi ${user.name},\n\n` +
          `Use this link to reset your password (valid for ${RESET_TOKEN_TTL_MINUTES} minutes):\n` +
          `${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      });
    } else {
      // Fallback for local environments without email credentials.
      console.info("Password reset link:", resetUrl);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not process forgot password request." }, { status: 400 });
  }
}
