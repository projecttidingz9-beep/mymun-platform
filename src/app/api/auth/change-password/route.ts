import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getRequestActor } from "@/lib/server/auth";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/server/password";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
    }
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: actor.email.toLowerCase() },
      select: { id: true, passwordHash: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "No current password set. Please use forgot password first." },
        { status: 400 }
      );
    }
    const currentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, deletedAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not change password." }, { status: 400 });
  }
}
