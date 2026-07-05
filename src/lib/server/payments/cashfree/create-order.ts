import type { PaymentIntent, Registration, User, Event } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { getSiteUrl } from "@/lib/site-url";
import { getCashfreeClient, toCashfreeOrderId } from "@/lib/server/payments/cashfree/client";
import { CashfreeOrderError } from "@/lib/server/payments/cashfree/order-request";
import { prisma } from "@/lib/server/prisma";

export { CashfreeOrderError } from "@/lib/server/payments/cashfree/order-request";
export { parseCashfreeOrderRequest } from "@/lib/server/payments/cashfree/order-request";

type PaymentIntentWithRelations = PaymentIntent & {
  registration: Registration & {
    user: Pick<User, "id" | "email" | "name">;
    event: Pick<Event, "id" | "title">;
  };
};

const pendingCashfreeIntentFilter = {
  provider: "CASHFREE" as const,
  status: "PENDING" as const,
};

export async function resolvePendingCashfreePaymentIntentId(params: {
  userId: string;
  registrationId?: string;
  paymentIntentId?: string;
}): Promise<string> {
  const registrationId = params.registrationId?.trim();
  const paymentIntentId = params.paymentIntentId?.trim();

  if (paymentIntentId) {
    const intent = await prisma.paymentIntent.findFirst({
      where: {
        id: paymentIntentId,
        ...pendingCashfreeIntentFilter,
        registration: { userId: params.userId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!intent) {
      throw new CashfreeOrderError("Payment not found or already completed.");
    }
    return intent.id;
  }

  if (registrationId) {
    const intent = await prisma.paymentIntent.findFirst({
      where: {
        registrationId,
        ...pendingCashfreeIntentFilter,
        registration: { userId: params.userId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!intent) {
      throw new CashfreeOrderError("Payment not found or already completed.");
    }
    return intent.id;
  }

  throw new CashfreeOrderError("registrationId or paymentIntentId is required.");
}

export async function createCashfreeOrderForPaymentIntent(params: {
  paymentIntentId: string;
  userId: string;
  customerPhone?: string;
  eventSlugOrId: string;
}): Promise<{ orderId: string; paymentSessionId: string; amount: number; currency: string }> {
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id: params.paymentIntentId,
      provider: "CASHFREE",
      status: "PENDING",
      registration: {
        userId: params.userId,
        deletedAt: null,
      },
    },
    include: {
      registration: {
        include: {
          user: { select: { id: true, email: true, name: true } },
          event: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!intent) {
    throw new CashfreeOrderError("Payment not found or already completed.");
  }

  const typedIntent = intent as PaymentIntentWithRelations;
  const amount = Number(typedIntent.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CashfreeOrderError("Invalid payment amount.");
  }

  const existingReference = typedIntent.reference?.trim();
  if (existingReference) {
    const raw =
      typeof typedIntent.raw === "object" && typedIntent.raw !== null
        ? (typedIntent.raw as Record<string, unknown>)
        : {};
    const cashfreeOrder = raw.cashfreeOrder as { payment_session_id?: string } | undefined;
    if (cashfreeOrder?.payment_session_id) {
      return {
        orderId: existingReference,
        paymentSessionId: cashfreeOrder.payment_session_id,
        amount,
        currency: typedIntent.currency,
      };
    }
  }

  const orderId = existingReference || toCashfreeOrderId(typedIntent.id);
  const appUrl = getSiteUrl();
  const returnUrl = `${appUrl}/checkout/${encodeURIComponent(params.eventSlugOrId)}/payment-return?order_id={order_id}`;

  const phone = (params.customerPhone || "").replace(/\D/g, "").slice(-10) || "9999999999";

  // Serialize concurrent order creation: only one request may claim a new reference.
  if (!existingReference) {
    const claim = await prisma.paymentIntent.updateMany({
      where: { id: typedIntent.id, reference: null },
      data: { reference: orderId },
    });
      if (claim.count === 0) {
        const claimed = await prisma.paymentIntent.findUnique({
          where: { id: typedIntent.id },
          select: { reference: true, raw: true, amount: true, currency: true },
        });
        const claimedReference = claimed?.reference?.trim();
        if (claimed && claimedReference) {
          const raw =
            typeof claimed.raw === "object" && claimed.raw !== null
              ? (claimed.raw as Record<string, unknown>)
              : {};
          const cashfreeOrder = raw.cashfreeOrder as { payment_session_id?: string } | undefined;
          if (cashfreeOrder?.payment_session_id) {
            return {
              orderId: claimedReference,
              paymentSessionId: cashfreeOrder.payment_session_id,
              amount: Number(claimed.amount),
              currency: claimed.currency,
            };
          }
          throw new CashfreeOrderError("Payment is being prepared. Please try again in a moment.");
        }
      }
  }

  const cashfree = getCashfreeClient();
  const response = await cashfree.PGCreateOrder({
    order_id: orderId,
    order_amount: amount,
    order_currency: typedIntent.currency || "INR",
    customer_details: {
      customer_id: typedIntent.registration.user.id,
      customer_email: typedIntent.registration.user.email,
      customer_phone: phone,
    },
    order_meta: {
      return_url: returnUrl,
      notify_url: `${appUrl}/api/webhooks/cashfree`,
    },
    order_note: `Registration for ${typedIntent.registration.event.title}`,
    order_tags: {
      registrationId: typedIntent.registrationId,
      paymentIntentId: typedIntent.id,
      eventId: typedIntent.registration.event.id,
    },
  });

  const paymentSessionId = response.data.payment_session_id;
  if (!paymentSessionId) {
    throw new CashfreeOrderError("Cashfree did not return a payment session.");
  }

  await prisma.paymentIntent.update({
    where: { id: typedIntent.id },
    data: {
      reference: orderId,
      raw: {
        ...(typeof typedIntent.raw === "object" && typedIntent.raw !== null
          ? (typedIntent.raw as Record<string, unknown>)
          : {}),
        cashfreeOrder: JSON.parse(JSON.stringify(response.data)),
      } as Prisma.InputJsonValue,
    },
  });

  return {
    orderId,
    paymentSessionId,
    amount,
    currency: typedIntent.currency,
  };
}

export async function fetchCashfreeOrderStatus(orderId: string) {
  const cashfree = getCashfreeClient();
  const response = await cashfree.PGFetchOrder(orderId);
  return response.data;
}
