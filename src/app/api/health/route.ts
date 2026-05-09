import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - started;
    return NextResponse.json({
      ok: true,
      status: "healthy",
      version: process.env.npm_package_version ?? "0.1.0",
      dbLatencyMs,
    });
  } catch {
    return NextResponse.json(
      { ok: false, status: "unhealthy", version: process.env.npm_package_version ?? "0.1.0" },
      { status: 503 }
    );
  }
}
