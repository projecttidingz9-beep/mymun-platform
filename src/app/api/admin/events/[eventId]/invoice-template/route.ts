import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestActor, isSuperAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const MAX_TEMPLATE_BYTES = 4 * 1024 * 1024;

/** Super-admin-only: configure or clear the invoice template used when generating this conference's payment invoices. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "").trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    url?: unknown;
    fileName?: unknown;
  };

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";

  if (url && url.length > MAX_TEMPLATE_BYTES) {
    return NextResponse.json({ error: "Template file is too large." }, { status: 400 });
  }

  const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null }, select: { id: true } });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  await prisma.organizerConferenceConfig.upsert({
    where: { eventId },
    update: {
      invoiceTemplateUrl: url || null,
      invoiceTemplateFileName: url ? fileName || null : null,
    },
    create: {
      eventId,
      invoiceTemplateUrl: url || null,
      invoiceTemplateFileName: url ? fileName || null : null,
    },
  });

  return NextResponse.json({ ok: true, url: url || null, fileName: url ? fileName || null : null });
}
