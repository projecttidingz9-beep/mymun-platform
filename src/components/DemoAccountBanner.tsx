"use client";

import { useState } from "react";

export default function DemoAccountBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="mb-4 rounded-xl px-4 py-3 flex items-start justify-between gap-3"
      style={{
        background: "rgba(245,158,11,0.12)",
        border: "1px solid rgba(245,158,11,0.28)",
      }}
      role="status"
    >
      <p className="text-sm text-amber-800 dark:text-amber-200">
        You are viewing a demo account. Changes are read-only and will not be saved.
      </p>
      <button
        type="button"
        className="btn btn-ghost text-xs shrink-0"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo account notice"
      >
        Dismiss
      </button>
    </div>
  );
}
