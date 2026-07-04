"use client";

import type { SelectHTMLAttributes } from "react";

type AppSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

/**
 * Shared select styling so forms avoid the stock browser look.
 * Uses the existing `.app-select-modern` / `.input-base` tokens.
 */
export default function AppSelect({ label, className, children, id, ...props }: AppSelectProps) {
  const selectId = id || (label ? `select-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={selectId} className="text-xs font-semibold block mb-1" style={{ color: "var(--fg-muted)" }}>
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={["input-base app-select-modern w-full", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
