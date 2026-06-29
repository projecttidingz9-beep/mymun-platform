"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tidingz_cookie_consent";

type ConsentValue = "accepted" | "rejected";

function readConsent(): ConsentValue | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "accepted" || raw === "rejected") return raw;
    return null;
  } catch {
    return null;
  }
}

function writeConsent(value: ConsentValue) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(`${STORAGE_KEY}_at`, new Date().toISOString());
  } catch {
    // ignore
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      if (!readConsent()) setVisible(true);
    });
  }, []);

  const finish = (value: ConsentValue) => {
    writeConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed z-[100] bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm rounded-2xl border px-4 py-3 shadow-lg"
      style={{
        background: "color-mix(in srgb, var(--bg) 94%, transparent 6%)",
        borderColor: "var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      role="dialog"
      aria-label="Cookie consent"
    >
      <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
        Essential cookies only until you opt in.{" "}
        <a href="/legal/cookies" className="underline">
          Cookie Policy
        </a>
      </p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          className="btn text-xs px-3 py-2 min-h-[36px] flex-1"
          style={{ border: "1px solid var(--border)" }}
          onClick={() => finish("rejected")}
        >
          Reject optional
        </button>
        <button
          type="button"
          className="btn btn-primary text-xs px-3 py-2 min-h-[36px] flex-1"
          onClick={() => finish("accepted")}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
