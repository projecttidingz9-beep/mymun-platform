import { NextRequest, NextResponse } from "next/server";
import { verifyEmailWithToken } from "@/lib/server/email-verification";
import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Verification token is required." }, { status: 400 });
  }

  const result = await verifyEmailWithToken(token);
  if (!result.ok) {
    const dashboard = `${getSiteUrl()}/dashboard`;
    return NextResponse.redirect(
      new URL(`/dashboard?verify=failed`, getSiteUrl())
    );
  }

  return NextResponse.redirect(new URL("/dashboard?verified=1", getSiteUrl()));
}
