export class CashfreeOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashfreeOrderError";
  }
}

export function parseCashfreeOrderRequest(body: Record<string, unknown>) {
  const paymentIntentId = String(body.paymentIntentId || "").trim() || undefined;
  const registrationId = String(body.registrationId || "").trim() || undefined;
  const eventSlugOrId = String(body.eventId || body.eventSlugOrId || "").trim();
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone : undefined;

  if (!paymentIntentId && !registrationId) {
    throw new CashfreeOrderError("registrationId or paymentIntentId is required.");
  }
  if (!eventSlugOrId) {
    throw new CashfreeOrderError("eventId is required.");
  }

  return { paymentIntentId, registrationId, eventSlugOrId, customerPhone };
}
