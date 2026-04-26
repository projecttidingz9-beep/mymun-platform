"use client";

import { useEffect } from "react";

const THEME_STORAGE_KEY = "tidingz_dark";

const applyTheme = (isDark: boolean) => {
  document.documentElement.classList.toggle("dark", isDark);
};

export default function ThemeController() {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(stored === "true");

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      applyTheme(event.newValue === "true");
    };

    const onThemeChanged = () => {
      const latest = localStorage.getItem(THEME_STORAGE_KEY);
      applyTheme(latest === "true");
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
