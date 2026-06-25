import { describe, expect, it } from "vitest";
import {
  CashfreeOrderError,
  parseCashfreeOrderRequest,
} from "@/lib/server/payments/cashfree/order-request";
import {
  extractOrderIdFromWebhook,
  isCashfreePaymentSuccess,
  isCashfreeWebhookConnectivityCheck,
} from "@/lib/server/payments/cashfree/verify-webhook";

describe("parseCashfreeOrderRequest", () => {
  it("accepts registrationId and eventId", () => {
    const parsed = parseCashfreeOrderRequest({
      registrationId: "reg-123",
      eventId: "conf-abc",
      customerPhone: "9876543210",
    });
    expect(parsed).toEqual({
      registrationId: "reg-123",
      paymentIntentId: undefined,
      eventSlugOrId: "conf-abc",
      customerPhone: "9876543210",
    });
  });

  it("accepts paymentIntentId as an alternative", () => {
    const parsed = parseCashfreeOrderRequest({
      paymentIntentId: "pi-456",
      eventSlugOrId: "conf-abc",
    });
    expect(parsed.paymentIntentId).toBe("pi-456");
    expect(parsed.eventSlugOrId).toBe("conf-abc");
  });

  it("requires registrationId or paymentIntentId", () => {
    expect(() => parseCashfreeOrderRequest({ eventId: "conf-abc" })).toThrow(CashfreeOrderError);
  });

  it("requires eventId", () => {
    expect(() => parseCashfreeOrderRequest({ registrationId: "reg-123" })).toThrow(CashfreeOrderError);
  });
});

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
