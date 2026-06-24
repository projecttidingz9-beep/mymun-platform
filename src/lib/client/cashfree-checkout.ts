import { load } from "@cashfreepayments/cashfree-js";

export type CashfreeCheckoutMode = "sandbox" | "production";

export function getClientCashfreeMode(): CashfreeCheckoutMode {
  const raw = process.env.NEXT_PUBLIC_CASHFREE_MODE?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export async function openCashfreeCheckout(paymentSessionId: string) {
  const cashfree = await load({ mode: getClientCashfreeMode() });
  if (!cashfree) {
    throw new Error("Cashfree checkout is unavailable in this environment.");
  }

  await cashfree.checkout({
    paymentSessionId,
    redirectTarget: "_self",
  });
}

export async function createCashfreeOrder(params: {
  paymentIntentId: string;
  eventId: string;
  customerPhone?: string;
}): Promise<{ paymentSessionId: string; orderId: string }> {
  const res = await fetch("/api/payments/cashfree/orders", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    paymentSessionId?: string;
    orderId?: string;
  };

  if (!res.ok || !payload.paymentSessionId || !payload.orderId) {
    throw new Error(payload.error || "Could not start payment.");
  }

  return {
    paymentSessionId: payload.paymentSessionId,
    orderId: payload.orderId,
  };
}
