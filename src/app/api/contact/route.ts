import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { env } from "@/lib/server/env";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const message = String(body.message || "").trim();
  if (!email.includes("@") || message.length < 10) {
    return NextResponse.json({ error: "Valid email and message (10+ chars) required." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
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
