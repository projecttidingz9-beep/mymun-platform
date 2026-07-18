export function normalizeDelegationCode(value: string): string {
  const trimmed = value.trim();
  return /^[a-z0-9]{10}$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}
