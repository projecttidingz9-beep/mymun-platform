"use client";

import { useEffect } from "react";
import { applyThemeClass, readStoredThemeDark, THEME_STORAGE_KEY } from "@/lib/theme";

export default function ThemeController() {
  useEffect(() => {
    applyThemeClass(readStoredThemeDark());

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      applyThemeClass(event.newValue === "true");
    };

    const onThemeChanged = () => {
      applyThemeClass(readStoredThemeDark());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("tidingz-theme-change", onThemeChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tidingz-theme-change", onThemeChanged);
    };
  }, []);

  return null;
}
