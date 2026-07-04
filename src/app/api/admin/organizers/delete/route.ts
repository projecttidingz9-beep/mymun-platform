import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, isSuperAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";

/**
 * Super-admin-only: permanently deletes an organizer account, e.g. after handling an
 * organizer's "delete my account" email request. Refuses to proceed while the organizer still
 * owns any non-archived/cancelled conference, so data isn't silently orphaned — the admin must
 * suspend/archive or reassign those first.
 */
export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    return NextResponse.json({ error: "Organizer account not found." }, { status: 404 });
  }
  if (user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "This tool only deletes organizer accounts." }, { status: 400 });
  }

  const activeEventCount = await prisma.event.count({
    where: {
      ownerUserId: user.id,
      deletedAt: null,
      status: { in: ["DRAFT", "REVIEW", "PUBLISHED", "SUSPENDED"] },
    },
  });
  if (activeEventCount > 0) {
    return NextResponse.json(
      {
        error: `This organizer still owns ${activeEventCount} active conference(s). Suspend or archive them before deleting the account.`,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  logger.info("admin_organizer_account_deleted", { actorEmail: actor!.email, deletedEmail: email });

  return NextResponse.json({ ok: true });
}
