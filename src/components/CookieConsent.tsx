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
      className="fixed bottom-0 inset-x-0 z-[100] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-t"
      style={{
        background: "var(--bg)",
        borderColor: "var(--border)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
      }}
      role="dialog"
      aria-label="Cookie consent"
    >
      <p className="text-xs sm:text-sm max-w-3xl leading-relaxed" style={{ color: "var(--fg-muted)" }}>
        We use essential cookies for sign-in and security. Optional analytics are off until you accept. See our{" "}
        <a href="/legal/cookies" className="underline">
          Cookie Policy
        </a>
        .
      </p>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
        <button
          type="button"
          className="btn text-sm px-6 py-3 min-h-[44px] w-full sm:w-auto"
          style={{ border: "1.5px solid var(--border)" }}
          onClick={() => finish("rejected")}
        >
          Reject optional
        </button>
        <button
          type="button"
          className="btn btn-primary text-sm px-6 py-3 min-h-[44px] w-full sm:w-auto"
          onClick={() => finish("accepted")}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
