import type { PaymentIntent, Registration, User, Event } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { getSiteUrl } from "@/lib/site-url";
import { getCashfreeClient, toCashfreeOrderId } from "@/lib/server/payments/cashfree/client";
import { prisma } from "@/lib/server/prisma";

export class CashfreeOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashfreeOrderError";
  }
}

type PaymentIntentWithRelations = PaymentIntent & {
  registration: Registration & {
    user: Pick<User, "id" | "email" | "name">;
    event: Pick<Event, "id" | "title">;
  };
};

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

  const orderId = typedIntent.reference?.trim() || toCashfreeOrderId(typedIntent.id);
  const appUrl = getSiteUrl();
  const returnUrl = `${appUrl}/checkout/${encodeURIComponent(params.eventSlugOrId)}/payment-return?order_id={order_id}`;

  const phone = (params.customerPhone || "").replace(/\D/g, "").slice(-10) || "9999999999";

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
