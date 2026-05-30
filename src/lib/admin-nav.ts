export const SUPER_ADMIN_HREF = "/admin";
export const SUPER_ADMIN_LABEL = "Super Dashboard";

function normalizeEmail(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

/** Client-visible allowlist — must match server `ADMIN_EMAIL` (set `NEXT_PUBLIC_ADMIN_EMAIL` in env). */
export function getSuperAdminAllowlistedEmail(): string {
  return normalizeEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL);
}

/**
 * Show Super Dashboard nav only for the configured super-admin account
 * (role `admin` + email matches `NEXT_PUBLIC_ADMIN_EMAIL`).
 */
export function canAccessSuperDashboard(role?: string, email?: string): boolean {
  const allowed = getSuperAdminAllowlistedEmail();
  if (!allowed) return false;
  return role === "admin" && normalizeEmail(email) === allowed;
}

/** @deprecated Use canAccessSuperDashboard(role, email) */
export function isSuperAdminRole(role?: string, email?: string): boolean {
  return canAccessSuperDashboard(role, email);
}
