/** Normalize to last 10 digits (strips +91, spaces, dashes). */
export function normalizeIndianMobilePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

export function isValidIndianMobilePhone(raw: string): boolean {
  const normalized = normalizeIndianMobilePhone(raw);
  return /^[6-9]\d{9}$/.test(normalized);
}

export function parseIndianMobilePhone(
  body: Record<string, unknown>
): string | undefined {
  const direct = typeof body.phone === "string" ? body.phone.trim() : "";
  const fromAnswers =
    body.formAnswers && typeof body.formAnswers === "object"
      ? String((body.formAnswers as Record<string, unknown>).phone || "").trim()
      : "";

  const raw = direct || fromAnswers;
  return raw || undefined;
}
