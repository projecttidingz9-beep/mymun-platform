import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { prisma } from "@/lib/server/prisma";
import {
  CashfreeOrderError,
  createCashfreeOrderForPaymentIntent,
  isCashfreeConfigured,
  parseCashfreeOrderRequest,
  resolvePendingCashfreePaymentIntentId,
} from "@/lib/server/payments/cashfree";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (actor.role === "organizer") {
    return NextResponse.json({ error: "Organizers cannot pay as delegates." }, { status: 403 });
  }

  if (!isCashfreeConfigured()) {
    return NextResponse.json({ error: "Online payments are not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseCashfreeOrderRequest(body);

    const user = await prisma.user.findUnique({
      where: { email: actor.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User profile not found." }, { status: 400 });
    }

    const paymentIntentId = await resolvePendingCashfreePaymentIntentId({
      userId: user.id,
      registrationId: parsed.registrationId,
      paymentIntentId: parsed.paymentIntentId,
    });

    const order = await createCashfreeOrderForPaymentIntent({
      paymentIntentId,
      userId: user.id,
      customerPhone: parsed.customerPhone,
      eventSlugOrId: parsed.eventSlugOrId,
    });

    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    if (error instanceof CashfreeOrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("cashfree_create_order_failed", {
      email: actor.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not start payment." }, { status: 500 });
  }
}
