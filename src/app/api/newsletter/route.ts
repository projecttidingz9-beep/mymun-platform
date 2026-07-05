import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { env } from "@/lib/server/env";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { getClientIp } from "@/lib/server/request-ip";
import { newsletterBodySchema } from "@/lib/server/validators/newsletter";
import { logger } from "@/lib/server/logger";

/** Records signup via ops inbox; subscriber receives an acknowledgment only when Resend is configured. */
export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => ({}));
  const parsed = newsletterBodySchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const ip = getClientIp(request);
  const ok = await consumeRateLimitBucket({
    key: `newsletter:${ip}`,
    windowMs: 60 * 60 * 1000,
    limit: 30,
  });
  if (!ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const apiKey = env.resendApiKey();
  const from = env.resendFromEmail();
  if (!apiKey || !from) {
    if (env.isProduction()) {
      return NextResponse.json(
        { error: "Newsletter signup is temporarily unavailable. Try again later or email support@tidingz.com." },
        { status: 503 }
      );
    }
    return NextResponse.json({
      ok: true,
      message: "Thanks — we saved your interest locally (email service not configured in development).",
    });
  }

  const resend = new Resend(apiKey);
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@tidingz.com";
  try {
    await Promise.all([
      resend.emails.send({
        from,
        to: support,
        subject: `[Tidingz Newsletter signup] ${email}`,
        text: `Newsletter signup:\n${email}`,
      }),
      resend.emails.send({
        from,
        to: email,
        subject: "You're on the Tidingz conference alerts list",
        text: `Thanks for subscribing to Tidingz conference alerts.\n\nWe'll email you about new conferences and application deadlines. You can reply to this message if you need help.\n\n— Tidingz`,
      }),
    ]);
  } catch (error) {
    logger.error("newsletter_email_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not complete newsletter signup. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Thanks for subscribing. Check your inbox for a confirmation from us.",
  });
}
