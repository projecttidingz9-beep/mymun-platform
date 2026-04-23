import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { hashResetToken } from "@/lib/server/reset-token";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ valid: false, error: "Token is required." }, { status: 400 });
  }
  const tokenHash = hashResetToken(token);
  const match = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return NextResponse.json({ valid: Boolean(match) });
}
