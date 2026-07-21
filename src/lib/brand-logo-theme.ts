/**
 * Marketing pages with a dark immersive surface: navbar and footer both use
 * the dark lockup assets on these routes.
 */
const FORCE_DARK_BRAND_LOGO_PATHS = new Set(["/", "/organizers"]);

export function shouldForceDarkBrandLogo(pathname: string): boolean {
  const p =
    pathname === "/" || pathname === ""
      ? "/"
      : pathname.replace(/\/$/, "") || "/";
  return FORCE_DARK_BRAND_LOGO_PATHS.has(p);
}
