"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastContextValue = {
  show: (message: string, variant?: "info" | "success" | "error") => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    const noop: ToastContextValue["show"] = () => {};
    return { show: noop };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ message: string; variant: "info" | "success" | "error" } | null>(
    null
  );

  const show = useCallback((message: string, variant: "info" | "success" | "error" = "info") => {
    setOpen({ message, variant });
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(null), 4200);
    return () => window.clearTimeout(t);
  }, [open]);

  const value = useMemo(() => ({ show }), [show]);

  const bg =
    open?.variant === "success"
      ? "rgba(22,163,74,0.92)"
      : open?.variant === "error"
        ? "rgba(220,38,38,0.92)"
        : "color-mix(in srgb, var(--fg) 88%, transparent 12%)";

  return (
    <ToastContext.Provider value={value}>
      {children}
      {open && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[200] max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
          style={{ background: bg }}
        >
          {open.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
