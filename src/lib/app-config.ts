import type { PaymentsMode } from "@/lib/types-payments";
import { CANONICAL_SITE_ORIGIN, getSiteUrl } from "@/lib/site-url";

/**
 * Non-secret runtime config (reads from env / defaults).
 * Safe to call from server or client for NEXT_PUBLIC_* vars.
 */
export function getAppConfig() {
  const rawMode = process.env.PAYMENTS_MODE?.toLowerCase();
  const paymentsMode: PaymentsMode =
    rawMode === "free" || rawMode === "manual" ? rawMode : "manual";

  return {
    paymentsMode,
    currency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.trim() || "INR",
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@tidingz.com",
    appUrl: getSiteUrl(),
    marketingSiteUrl: process.env.NEXT_PUBLIC_MARKETING_URL?.trim() || CANONICAL_SITE_ORIGIN,
  };
}
