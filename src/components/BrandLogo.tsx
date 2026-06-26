"use client";

import Image from "next/image";

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
      return isDark ? "/brand/logo-vertical-dark.png" : "/brand/logo-vertical-light.png";
    case "verticalCompact":
      return isDark ? "/brand/logo-vertical-dark-pfp.png" : "/brand/logo-vertical-light.png";
    case "icon":
      return isDark ? "/brand/logo-icon-dark.png" : "/brand/logo-icon-light.png";
    default:
      return "/brand/logo-horizontal-light.png";
  }
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

function LogoImage({
  variant,
  isDark,
  className,
  priority,
  sizes,
}: {
  variant: BrandLogoVariant;
  isDark: boolean;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const { width, height, alt } = DIMS[variant];
  return (
    <Image
      src={resolveSrc(variant, isDark)}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      sizes={sizes}
    />
  );
}

export default function BrandLogo({
  variant,
  className,
  priority,
  sizes,
  themeOverride,
}: BrandLogoProps) {
  const { width, height, alt } = DIMS[variant];

  if (themeOverride === "dark") {
    return (
      <LogoImage
        variant={variant}
        isDark
        className={className}
        priority={priority}
        sizes={sizes}
      />
    );
  }

  if (themeOverride === "light") {
    return (
      <LogoImage
        variant={variant}
        isDark={false}
        className={className}
        priority={priority}
        sizes={sizes}
      />
    );
  }

  const lightSrc = resolveSrc(variant, false);
  const darkSrc = resolveSrc(variant, true);

  return (
    <span className="inline-flex items-center">
      <Image
        src={lightSrc}
        alt={alt}
        width={width}
        height={height}
        className={`brand-logo-light ${className ?? ""}`}
        priority={priority}
        sizes={sizes}
      />
      <Image
        src={darkSrc}
        alt={alt}
        width={width}
        height={height}
        className={`brand-logo-dark ${className ?? ""}`}
        priority={priority}
        sizes={sizes}
      />
    </span>
  );
}
