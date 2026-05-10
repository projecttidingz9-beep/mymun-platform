"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "tidingz_dark";

export type BrandLogoVariant = "horizontal" | "vertical" | "verticalCompact" | "icon";

export type BrandLogoProps = {
  variant: BrandLogoVariant;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Use when the logo sits on a fixed dark/light surface regardless of app theme (e.g. auth modal header). */
  themeOverride?: "dark" | "light";
};

function resolveSrc(variant: BrandLogoVariant, isDark: boolean): string {
  switch (variant) {
    case "horizontal":
      return isDark ? "/brand/logo-horizontal-dark.png" : "/brand/logo-horizontal-light.png";
    case "vertical":
      return isDark ? "/brand/logo-vertical-dark.png" : "/brand/logo-horizontal-light.png";
    case "verticalCompact":
      return isDark ? "/brand/logo-vertical-dark-pfp.png" : "/brand/logo-horizontal-light.png";
    case "icon":
      return isDark ? "/brand/logo-icon-dark.png" : "/brand/logo-icon-light.png";
    default:
      return "/brand/logo-horizontal-light.png";
  }
}

function readIsDark(): boolean {
  if (typeof document === "undefined") return false;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const domDark = document.documentElement.classList.contains("dark");
  return stored === null ? domDark : stored === "true";
}

/** Intrinsic dimensions for layout (images scale via className). */
const DIMS: Record<
  BrandLogoVariant,
  { width: number; height: number; alt: string }
> = {
  horizontal: { width: 320, height: 72, alt: "Tidingz" },
  vertical: { width: 220, height: 160, alt: "Tidingz" },
  verticalCompact: { width: 180, height: 180, alt: "Tidingz" },
  icon: { width: 256, height: 256, alt: "Tidingz" },
};

export default function BrandLogo({
  variant,
  className,
  priority,
  sizes,
  themeOverride,
}: BrandLogoProps) {
  const usesLiveTheme = themeOverride === undefined;

  const [liveDark, setLiveDark] = useState(() =>
    usesLiveTheme && typeof window !== "undefined" ? readIsDark() : false,
  );

  useEffect(() => {
    if (!usesLiveTheme) return;

    const sync = () => setLiveDark(readIsDark());

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      sync();
    };
    const onThemeChanged = () => sync();

    window.addEventListener("storage", onStorage);
    window.addEventListener("tidingz-theme-change", onThemeChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tidingz-theme-change", onThemeChanged);
    };
  }, [usesLiveTheme]);

  const isDark =
    themeOverride === "dark" ? true : themeOverride === "light" ? false : liveDark;

  const src = resolveSrc(variant, isDark);
  const { width, height, alt } = DIMS[variant];

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      sizes={sizes}
    />
  );
}
