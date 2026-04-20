import { NextRequest, NextResponse } from "next/server";
import { signSessionToken } from "@/lib/server/session-token";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "delegate").toLowerCase();
    const name = String(body.name || email.split("@")[0] || "user");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (!["delegate", "organizer", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: role === "admin" ? "ADMIN" : role === "organizer" ? "ORGANIZER" : "DELEGATE",
      },
      create: {
        email,
        name,
        role: role === "admin" ? "ADMIN" : role === "organizer" ? "ORGANIZER" : "DELEGATE",
      },
    });

    const token = await signSessionToken({
      email,
      role: role as "delegate" | "organizer" | "admin",
      name,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set("mymun_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not establish session." }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mymun_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
