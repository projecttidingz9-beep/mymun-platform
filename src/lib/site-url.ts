/**
 * Canonical public site origin (no trailing slash).
 * Used when NEXT_PUBLIC_APP_URL is unset so metadata, sitemap, and OG URLs match production.
 */
export const CANONICAL_SITE_ORIGIN = "https://tidingz.com";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = raw && raw.length > 0 ? raw : CANONICAL_SITE_ORIGIN;
  return base.replace(/\/$/, "");
}
