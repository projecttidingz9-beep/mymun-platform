import { describe, expect, it } from "vitest";
import {
  extractOrderIdFromWebhook,
  isCashfreePaymentSuccess,
  isCashfreeWebhookConnectivityCheck,
} from "@/lib/server/payments/cashfree/verify-webhook";

describe("cashfree webhook helpers", () => {
  it("extracts order id from nested webhook payload", () => {
    const event = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      raw: "{}",
      object: {
        data: {
          order: { order_id: "tid_pi_abc123" },
        },
      },
    };

    expect(extractOrderIdFromWebhook(event)).toBe("tid_pi_abc123");
  });

  it("detects successful payment from order status", () => {
    const event = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      raw: "{}",
      object: {
        data: {
          order: { order_status: "PAID" },
          payment: { payment_status: "SUCCESS" },
        },
      },
    };

    expect(isCashfreePaymentSuccess(event)).toBe(true);
  });

  it("returns false for non-success statuses", () => {
    const event = {
      type: "PAYMENT_FAILED_WEBHOOK",
      raw: "{}",
      object: {
        data: {
          order: { order_status: "ACTIVE" },
          payment: { payment_status: "FAILED" },
        },
      },
    };

    expect(isCashfreePaymentSuccess(event)).toBe(false);
  });
});

describe("isCashfreeWebhookConnectivityCheck", () => {
  it("treats missing signature headers as a dashboard test", () => {
    expect(
      isCashfreeWebhookConnectivityCheck({
        signature: null,
        timestamp: null,
        rawBody: "{}",
      })
    ).toBe(true);
  });

  it("does not treat signed payloads as connectivity checks", () => {
    expect(
      isCashfreeWebhookConnectivityCheck({
        signature: "sig",
        timestamp: "123",
        rawBody: '{"type":"PAYMENT_SUCCESS_WEBHOOK"}',
      })
    ).toBe(false);
  });
});

describe("toCashfreeOrderId", () => {
  it("sanitizes payment intent ids", async () => {
    const { toCashfreeOrderId } = await import("@/lib/server/payments/cashfree/client");
    expect(toCashfreeOrderId("clxyz.123")).toBe("tid_clxyz_123");
  });
});
