import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { env } from "@/lib/server/env";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { getClientIp } from "@/lib/server/request-ip";
import { contactBodySchema } from "@/lib/server/validators/contact";

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => ({}));
  const parsed = contactBodySchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const message = parsed.data.message;

  const ip = getClientIp(request);
  const ok = await consumeRateLimitBucket({
    key: `contact:${ip}`,
    windowMs: 60 * 60 * 1000,
    limit: 20,
  });
  if (!ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const apiKey = env.resendApiKey();
  const from = env.resendFromEmail();
  if (!apiKey || !from) {
    return NextResponse.json({ ok: true, note: "Email not configured; message discarded." });
  }

  const resend = new Resend(apiKey);
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@tidingz.com";
  await resend.emails.send({
    from,
    to: support,
    subject: `[Tidingz Contact] ${email}`,
    text: `From: ${email}\n\n${message}`,
  });

  return NextResponse.json({ ok: true });
}
