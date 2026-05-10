import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getRequestActor, requireEventOrganizerAccess, requireOrganizer } from "@/lib/server/auth";
import { moneyNumber } from "@/lib/server/decimal-money";

/** Manual payments dashboard data — lists PaymentIntent rows for an event. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }
  const { eventId } = await context.params;
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const intents = await prisma.paymentIntent.findMany({
    where: {
      registration: { eventId },
    },
    include: {
      registration: {
        include: {
          user: { select: { email: true, name: true } },
        },
      },
      confirmedBy: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    paymentIntents: intents.map((row) => ({
      ...row,
      amount: moneyNumber(row.amount),
    })),
  });
}
