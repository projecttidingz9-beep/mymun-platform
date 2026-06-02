import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";
import { getClientIp } from "@/lib/server/request-ip";
import {
  createEmailVerificationToken,
  isUserEmailVerified,
  sendVerificationEmail,
} from "@/lib/server/email-verification";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ok = await consumeRateLimitBucket({
    key: `auth:resend-verify:${ip}`,
    windowMs: 60 * 60 * 1000,
    limit: 5,
  });
  if (!ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  if (await isUserEmailVerified(actor.email)) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "Email verification applies to password accounts. OAuth accounts are verified at sign-in." },
      { status: 400 }
    );
  }

  const raw = await createEmailVerificationToken(user.id);
  if (!raw) {
    return NextResponse.json({ error: "Could not create verification token." }, { status: 500 });
  }

  const sent = await sendVerificationEmail(user.email, raw);
  if (!sent) {
    return NextResponse.json(
      { error: "Email service is not configured. Contact support@tidingz.com." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, message: "Verification email sent." });
}
