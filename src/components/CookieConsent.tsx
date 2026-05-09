"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tidingz_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
      } catch {
        setVisible(true);
      }
    });
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[100] p-4 flex flex-col sm:flex-row gap-3 items-center justify-between border-t"
      style={{
        background: "var(--bg)",
        borderColor: "var(--border)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
      }}
      role="dialog"
      aria-label="Cookie consent"
    >
      <p className="text-xs max-w-3xl" style={{ color: "var(--fg-muted)" }}>
        We use essential cookies for sign-in and optional analytics when enabled. By continuing you agree to our{" "}
        <a href="/legal/cookies" className="underline">
          Cookie Policy
        </a>
        .
      </p>
      <button type="button" className="btn btn-primary text-xs px-5 py-2 shrink-0" onClick={accept}>
        Accept
      </button>
    </div>
  );
}
