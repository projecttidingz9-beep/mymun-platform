export const THEME_STORAGE_KEY = "tidingz_dark";

/** Blocking script injected in <head> so html.dark is set before first paint. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="false")document.documentElement.classList.add("dark");}catch(e){}})();`;

export function applyThemeClass(isDark: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
}

export function readStoredThemeDark(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}
