import { NextResponse } from "next/server";

/** Placeholder — wire Resend + verification tokens when outbound email is production-ready. */
export async function GET() {
  return NextResponse.json(
    {
      error: "Email verification is not enabled yet.",
      hint: "Contact support if you need to confirm your account.",
    },
    { status: 501 }
  );
}
