import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { prisma } from "@/lib/server/prisma";
import {
  confirmPaymentByOrderId,
  fetchCashfreeOrderStatus,
  isCashfreeConfigured,
} from "@/lib/server/payments/cashfree";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isCashfreeConfigured()) {
    return NextResponse.json({ error: "Online payments are not configured." }, { status: 503 });
  }

  const params = await context.params;
  const orderId = String(params.orderId || "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User profile not found." }, { status: 400 });
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: {
      reference: orderId,
      provider: "CASHFREE",
      registration: { userId: user.id, deletedAt: null },
    },
    select: { id: true, status: true, registrationId: true },
  });

  if (!intent) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  try {
    if (intent.status !== "CONFIRMED") {
      await confirmPaymentByOrderId(orderId);
    }

    const order = await fetchCashfreeOrderStatus(orderId);
    const registration = await prisma.registration.findUnique({
      where: { id: intent.registrationId },
      select: { paid: true },
    });

    return NextResponse.json({
      ok: true,
      orderId,
      orderStatus: order.order_status,
      paid: registration?.paid ?? false,
      registrationId: intent.registrationId,
    });
  } catch (error) {
    logger.error("cashfree_fetch_order_failed", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not fetch payment status." }, { status: 500 });
  }
}
