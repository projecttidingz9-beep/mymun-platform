/**
 * Marketing pages with a dark immersive hero: use dark-mode logo lockups
 * regardless of the global light/dark toggle (assets are designed for dark bg).
 */
const FORCE_DARK_BRAND_LOGO_PATHS = new Set(["/", "/organizers"]);

export function shouldForceDarkBrandLogo(pathname: string): boolean {
  const p =
    pathname === "/" || pathname === ""
      ? "/"
      : pathname.replace(/\/$/, "") || "/";
  return FORCE_DARK_BRAND_LOGO_PATHS.has(p);
}
