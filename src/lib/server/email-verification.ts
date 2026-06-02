import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/server/prisma";
import { env } from "@/lib/server/env";
import { getSiteUrl } from "@/lib/site-url";
import { logger } from "@/lib/server/logger";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createEmailVerificationToken(userId: string): Promise<string | null> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return raw;
}

export async function sendVerificationEmail(email: string, rawToken: string): Promise<boolean> {
  const apiKey = env.resendApiKey();
  const from = env.resendFromEmail();
  if (!apiKey || !from) {
    logger.warn("email_verification_skipped", { reason: "resend_not_configured" });
    return false;
  }

  const verifyUrl = `${getSiteUrl()}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: email,
    subject: "Verify your Tidingz email",
    text: `Welcome to Tidingz.\n\nVerify your email address by opening this link (valid 24 hours):\n${verifyUrl}\n\nIf you did not create an account, you can ignore this message.`,
    html: `<p>Welcome to Tidingz.</p><p><a href="${verifyUrl}">Verify your email address</a> (link valid 24 hours).</p><p>If you did not create an account, you can ignore this message.</p>`,
  });
  return true;
}

export async function verifyEmailWithToken(rawToken: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokenHash = hashToken(rawToken.trim());
  const record = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });

  if (!record) {
    return { ok: false, error: "Invalid or expired verification link." };
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
  ]);

  return { ok: true };
}

export async function isUserEmailVerified(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { emailVerified: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return false;
  return user.emailVerified;
}
