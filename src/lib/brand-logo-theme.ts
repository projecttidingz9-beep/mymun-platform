/**
 * Marketing pages with a dark immersive hero: navbar keeps dark lockups;
 * footer uses the light lockup asset on these routes.
 */
const FORCE_DARK_BRAND_LOGO_PATHS = new Set(["/", "/organizers"]);

export function shouldForceDarkBrandLogo(pathname: string): boolean {
  const p =
    pathname === "/" || pathname === ""
      ? "/"
      : pathname.replace(/\/$/, "") || "/";
  return FORCE_DARK_BRAND_LOGO_PATHS.has(p);
}
