import { prisma } from "@/lib/server/prisma";
import { fetchCashfreeOrderStatus } from "@/lib/server/payments/cashfree/create-order";

export type ConfirmPaymentResult =
  | { ok: true; alreadyConfirmed: boolean; registrationId: string }
  | { ok: false; reason: string };

export async function confirmPaymentByOrderId(orderId: string): Promise<ConfirmPaymentResult> {
  const normalizedOrderId = orderId.trim();
  if (!normalizedOrderId) {
    return { ok: false, reason: "Missing order id." };
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { reference: normalizedOrderId, provider: "CASHFREE" },
    include: {
      registration: {
        select: {
          id: true,
          paid: true,
          userId: true,
          eventId: true,
          event: { select: { title: true } },
        },
      },
    },
  });

  if (!intent) {
    return { ok: false, reason: "Payment intent not found." };
  }

  if (intent.status === "CONFIRMED" && intent.registration.paid) {
    return { ok: true, alreadyConfirmed: true, registrationId: intent.registrationId };
  }

  let orderStatus: string | undefined;
  try {
    const order = await fetchCashfreeOrderStatus(normalizedOrderId);
    orderStatus = order.order_status?.toUpperCase();
  } catch {
    return { ok: false, reason: "Could not verify order with Cashfree." };
  }

  if (orderStatus !== "PAID") {
    return { ok: false, reason: `Order is not paid (status: ${orderStatus || "unknown"}).` };
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.paymentIntent.findUnique({
      where: { id: intent.id },
      select: { status: true, registrationId: true },
    });
    if (!current || current.status === "CONFIRMED") return;

    await tx.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        notes: "Confirmed via Cashfree",
      },
    });

    await tx.registration.update({
      where: { id: intent.registrationId },
      data: { paid: true },
    });
  });

  const registration = intent.registration;
  const wasPaid = registration.paid;

  if (!wasPaid) {
    try {
      await prisma.notification.create({
        data: {
          userId: registration.userId,
          eventId: registration.eventId,
          registrationId: registration.id,
          title: "Payment confirmed",
          message: `Your payment for ${registration.event.title} has been confirmed.`,
          type: "PAYMENT_CONFIRMED",
        },
      });
    } catch {
      // Non-blocking.
    }
  }

  return { ok: true, alreadyConfirmed: false, registrationId: intent.registrationId };
}
