/**
 * Locale-aware currency display for client and server.
 * Prefer passing ISO 4217 codes from events (`currency` on Conference/Event).
 */
export function formatMoney(amount: number, currency = "INR", locale?: string): string {
  const safe = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale ?? "en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency ?? "INR"} ${safe.toFixed(2)}`;
  }
}
