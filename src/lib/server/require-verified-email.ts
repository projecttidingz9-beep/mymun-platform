import { NextResponse } from "next/server";
import type { RequestActor } from "@/lib/server/auth";
import { isUserEmailVerified } from "@/lib/server/email-verification";

const MESSAGE =
  "Please verify your email before continuing. Check your inbox for the verification link or request a new one from your dashboard.";

export async function requireVerifiedEmail(actor: RequestActor | null): Promise<NextResponse | null> {
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const verified = await isUserEmailVerified(actor.email);
  if (!verified) {
    return NextResponse.json(
      { error: MESSAGE, code: "EMAIL_NOT_VERIFIED" },
      { status: 403 }
    );
  }
  return null;
}
