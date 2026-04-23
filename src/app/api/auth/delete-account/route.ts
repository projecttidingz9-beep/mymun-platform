import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getRequestActor } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/password";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    const body = await request.json();
    const password = String(body.password || "");
    if (!password) {
      return NextResponse.json({ error: "Password confirmation is required." }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { email: actor.email.toLowerCase() },
      select: { id: true, passwordHash: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Password is not set for this account." }, { status: 400 });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Password is incorrect." }, { status: 401 });
    }

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
    const response = NextResponse.json({ ok: true });
    response.cookies.set("mymun_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not delete account." }, { status: 400 });
  }
}
