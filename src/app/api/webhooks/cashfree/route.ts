import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import {
  confirmPaymentByOrderId,
  extractOrderIdFromWebhook,
  isCashfreePaymentSuccess,
  isCashfreeWebhookConnectivityCheck,
  verifyCashfreeWebhook,
  CashfreeWebhookVerificationError,
} from "@/lib/server/payments/cashfree";
import { isNonRecoverablePaymentConfirmFailure } from "@/lib/server/payments/cashfree/confirm-payment";

export async function GET() {
  return NextResponse.json({ ok: true, service: "cashfree-webhook" });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  if (isCashfreeWebhookConnectivityCheck({ signature, timestamp, rawBody })) {
    return NextResponse.json({ ok: true });
  }

  try {
    const event = verifyCashfreeWebhook({ signature, timestamp, rawBody });
    const orderId = extractOrderIdFromWebhook(event);

    if (!orderId) {
      logger.warn("cashfree_webhook_missing_order_id", { type: event.type });
      return NextResponse.json({ ok: true });
    }

    if (isCashfreePaymentSuccess(event)) {
      const result = await confirmPaymentByOrderId(orderId, { trustVerifiedWebhookSuccess: true });
      if (!result.ok) {
        logger.warn("cashfree_webhook_confirm_failed", { orderId, reason: result.reason });
        if (isNonRecoverablePaymentConfirmFailure(result.reason)) {
          return NextResponse.json({ ok: true, skipped: true, reason: result.reason });
        }
        return NextResponse.json(
          { error: "Payment confirmation failed.", reason: result.reason },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CashfreeWebhookVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    logger.error("cashfree_webhook_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
