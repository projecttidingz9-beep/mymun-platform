import { Cashfree, CFEnvironment } from "cashfree-pg";
import { env } from "@/lib/server/env";

let cachedClient: Cashfree | null = null;

export function getCashfreeMode(): "sandbox" | "production" {
  const raw = process.env.NEXT_PUBLIC_CASHFREE_MODE?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function isCashfreeConfigured(): boolean {
  return Boolean(env.cashfreeClientId() && env.cashfreeClientSecret());
}

export function getCashfreeClient(): Cashfree {
  const clientId = env.cashfreeClientId();
  const clientSecret = env.cashfreeClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Cashfree is not configured. Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.");
  }

  if (!cachedClient) {
    const environment =
      getCashfreeMode() === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
    cachedClient = new Cashfree(environment, clientId, clientSecret);
  }

  return cachedClient;
}

/** Cashfree order_id allows alphanumeric, underscore, hyphen only. */
export function toCashfreeOrderId(paymentIntentId: string): string {
  const sanitized = paymentIntentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `tid_${sanitized}`.slice(0, 64);
}

export function resetCashfreeClientForTests() {
  cachedClient = null;
}
