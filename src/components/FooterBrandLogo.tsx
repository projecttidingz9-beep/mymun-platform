"use client";

import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { shouldForceDarkBrandLogo } from "@/lib/brand-logo-theme";

/** Matches navbar: dark immersive marketing pages keep dark lockups regardless of theme toggle. */
export default function FooterBrandLogo() {
  const pathname = usePathname() || "/";
  return (
    <BrandLogo
      variant="vertical"
      themeOverride={shouldForceDarkBrandLogo(pathname) ? "dark" : undefined}
      className="h-auto w-44 max-w-full object-contain object-left"
    />
  );
}
