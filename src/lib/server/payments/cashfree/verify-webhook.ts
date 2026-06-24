import type { PGWebhookEvent } from "cashfree-pg";
import { getCashfreeClient } from "@/lib/server/payments/cashfree/client";
import { env } from "@/lib/server/env";

export class CashfreeWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashfreeWebhookVerificationError";
  }
}

/** Cashfree dashboard "Test" pings may omit signature headers or send an empty body. */
export function isCashfreeWebhookConnectivityCheck(params: {
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}): boolean {
  if (!params.signature?.trim() || !params.timestamp?.trim()) {
    return true;
  }
  const body = params.rawBody.trim();
  return !body || body === "{}";
}

export function verifyCashfreeWebhook(params: {
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}): PGWebhookEvent {
  if (!params.signature || !params.timestamp) {
    throw new CashfreeWebhookVerificationError("Missing Cashfree webhook signature headers.");
  }

  if (!env.cashfreeClientSecret()) {
    throw new CashfreeWebhookVerificationError("Cashfree is not configured.");
  }

  try {
    const cashfree = getCashfreeClient();
    return cashfree.PGVerifyWebhookSignature(params.signature, params.rawBody, params.timestamp);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature.";
    throw new CashfreeWebhookVerificationError(message);
  }
}

export function extractOrderIdFromWebhook(event: PGWebhookEvent): string | null {
  const payload = event.object as {
    data?: { order?: { order_id?: string } };
    order?: { order_id?: string };
    order_id?: string;
  };

  return (
    payload?.data?.order?.order_id?.trim() ||
    payload?.order?.order_id?.trim() ||
    payload?.order_id?.trim() ||
    null
  );
}

export function isCashfreePaymentSuccess(event: PGWebhookEvent): boolean {
  const payload = event.object as {
    type?: string;
    data?: {
      order?: { order_status?: string };
      payment?: { payment_status?: string };
    };
  };

  const eventType = (event.type || payload?.type || "").toUpperCase();
  const orderStatus = payload?.data?.order?.order_status?.toUpperCase();
  const paymentStatus = payload?.data?.payment?.payment_status?.toUpperCase();

  if (orderStatus === "PAID") return true;
  if (paymentStatus === "SUCCESS" || paymentStatus === "PAID") return true;
  if (eventType.includes("PAYMENT_SUCCESS")) return true;

  return false;
}
