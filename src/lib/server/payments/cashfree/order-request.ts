import {
  isValidIndianMobilePhone,
  normalizeIndianMobilePhone,
} from "@/lib/server/validate-phone";

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
  const customerPhoneRaw =
    typeof body.customerPhone === "string" ? body.customerPhone.trim() : undefined;

  if (!paymentIntentId && !registrationId) {
    throw new CashfreeOrderError("registrationId or paymentIntentId is required.");
  }
  if (!eventSlugOrId) {
    throw new CashfreeOrderError("eventId is required.");
  }

  let customerPhone: string | undefined;
  if (customerPhoneRaw) {
    if (!isValidIndianMobilePhone(customerPhoneRaw)) {
      throw new CashfreeOrderError("Enter a valid 10-digit Indian mobile number.");
    }
    customerPhone = normalizeIndianMobilePhone(customerPhoneRaw);
  }

  return { paymentIntentId, registrationId, eventSlugOrId, customerPhone };
}
