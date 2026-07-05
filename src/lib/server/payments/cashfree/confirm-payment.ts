import { prisma } from "@/lib/server/prisma";
import { moneyNumber } from "@/lib/server/decimal-money";
import { fetchCashfreeOrderStatus } from "@/lib/server/payments/cashfree/create-order";

export type ConfirmPaymentResult =
  | { ok: true; alreadyConfirmed: boolean; registrationId: string }
  | { ok: false; reason: string };

function amountsMatch(expected: unknown, actual: unknown): boolean {
  const a = Math.round(moneyNumber(expected) * 100) / 100;
  const b = Math.round(moneyNumber(actual) * 100) / 100;
  return a === b;
}

function currenciesMatch(expected: string | null | undefined, actual: string | null | undefined): boolean {
  const a = (expected || "INR").trim().toUpperCase();
  const b = (actual || "INR").trim().toUpperCase();
  return a === b;
}

/** Non-recoverable webhook failures should return 200 so Cashfree stops retrying. */
export function isNonRecoverablePaymentConfirmFailure(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return (
    normalized.includes("payment intent not found") ||
    normalized.includes("registration no longer active") ||
    normalized.includes("does not match") ||
    normalized.includes("missing order id") ||
    normalized.includes("order is not paid")
  );
}

async function verifyCashfreeOrderMatchesIntent(
  orderId: string,
  intentAmount: unknown,
  intentCurrency: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let order: Awaited<ReturnType<typeof fetchCashfreeOrderStatus>>;
  try {
    order = await fetchCashfreeOrderStatus(orderId);
  } catch {
    return { ok: false, reason: "Could not verify order with Cashfree." };
  }

  const orderStatus = order.order_status?.toUpperCase();
  if (orderStatus !== "PAID") {
    return { ok: false, reason: `Order is not paid (status: ${orderStatus || "unknown"}).` };
  }

  if (!amountsMatch(intentAmount, order.order_amount)) {
    return {
      ok: false,
      reason: "Paid amount does not match registration fee.",
    };
  }

  if (!currenciesMatch(intentCurrency, order.order_currency)) {
    return {
      ok: false,
      reason: "Paid currency does not match registration currency.",
    };
  }

  return { ok: true };
}

export async function confirmPaymentByOrderId(
  orderId: string,
  options?: { trustVerifiedWebhookSuccess?: boolean }
): Promise<ConfirmPaymentResult> {
  void options;
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
          deletedAt: true,
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

  if (intent.registration.deletedAt != null) {
    return { ok: false, reason: "Registration no longer active." };
  }

  if (intent.status === "CONFIRMED" && intent.registration.paid) {
    return { ok: true, alreadyConfirmed: true, registrationId: intent.registrationId };
  }

  const verification = await verifyCashfreeOrderMatchesIntent(
    normalizedOrderId,
    intent.amount,
    intent.currency
  );
  if (!verification.ok) {
    return verification;
  }

  const newlyPaid = await prisma.$transaction(async (tx) => {
    const current = await tx.paymentIntent.findUnique({
      where: { id: intent.id },
      select: {
        status: true,
        registrationId: true,
        registration: { select: { paid: true, deletedAt: true } },
      },
    });
    if (!current || current.status === "CONFIRMED") {
      return false;
    }
    if (current.registration.deletedAt != null) {
      return false;
    }

    const wasPaid = current.registration.paid;

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

    return !wasPaid;
  });

  if (newlyPaid === false && intent.registration.paid) {
    return { ok: true, alreadyConfirmed: true, registrationId: intent.registrationId };
  }

  if (newlyPaid) {
    const registration = intent.registration;
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
    } catch (error) {
      console.warn("[confirmPaymentByOrderId] notification create failed", error);
    }
  }

  return { ok: true, alreadyConfirmed: false, registrationId: intent.registrationId };
}
