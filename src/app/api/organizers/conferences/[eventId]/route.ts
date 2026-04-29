import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireOrganizer } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const params = await context.params;
  const eventId = String(params.eventId || "");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const paidRegistrationCount = await prisma.registration.count({
    where: { eventId, paid: true },
  });
  if (paidRegistrationCount > 0) {
    return NextResponse.json(
      { error: "Conference cannot be deleted once payments have started." },
      { status: 409 }
    );
  }

  await prisma.event.deleteMany({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
