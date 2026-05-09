import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { env } from "@/lib/server/env";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";

/** Double-opt-in placeholder: stores intent via email to ops inbox until marketing automation is wired. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
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
    return NextResponse.json({ ok: true, note: "Newsletter request noted (email service offline)." });
  }

  const resend = new Resend(apiKey);
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@tidingz.com";
  await resend.emails.send({
    from,
    to: support,
    subject: `[Tidingz Newsletter signup] ${email}`,
    text: `Newsletter signup:\n${email}\n\nReply with confirmation link when automation is ready.`,
  });

  return NextResponse.json({
    ok: true,
    message: "Check your inbox for a confirmation email — coming soon for production automation.",
  });
}
