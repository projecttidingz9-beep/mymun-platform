/** Normalize Prisma/cache values that may arrive as ISO strings instead of Date instances. */
export function coerceDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toIsoString(value: Date | string): string {
  return coerceDate(value).toISOString();
}
