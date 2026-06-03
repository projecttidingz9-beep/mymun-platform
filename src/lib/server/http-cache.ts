/** CDN-friendly cache for public catalog responses (Vercel s-maxage). */
export const MARKETPLACE_CATALOG_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=300";

/** Slightly fresher cache for single published conference detail. */
export const MARKETPLACE_DETAIL_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=120";
