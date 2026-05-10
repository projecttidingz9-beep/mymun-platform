"use client";

import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

/** Matches navbar: on the immersive home hero (`/`), logo stays dark regardless of theme toggle. */
export default function FooterBrandLogo() {
  const pathname = usePathname() || "/";
  return (
    <BrandLogo
      variant="vertical"
      themeOverride={pathname === "/" ? "dark" : undefined}
      className="h-auto w-44 max-w-full object-contain object-left"
    />
  );
}
