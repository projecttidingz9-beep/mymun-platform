"use client";

import Link from "next/link";
import type { AdminSection } from "./types";

const NAV: { id: AdminSection; label: string }[] = [
  { id: "review", label: "Review queue" },
  { id: "overview", label: "Overview" },
  { id: "events", label: "All conferences" },
  { id: "daily-stats", label: "Daily stats" },
];

type AdminShellProps = {
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  pendingCount: number;
  children: React.ReactNode;
};

export default function AdminShell({
  section,
  onSectionChange,
  pendingCount,
  children,
}: AdminShellProps) {
  return (
    <div className="max-w-7xl mx-auto pb-12">
      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--fg-muted)]">Platform</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--fg)]">
          Super admin
        </h1>
        <p className="text-sm sm:text-base text-[var(--fg-muted)] max-w-2xl">
          Review organizer submissions, publish conferences to the marketplace, and monitor platform
          health.
        </p>
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-[var(--blue)] hover:underline focus-visible:outline-none"
        >
          Back to home
        </Link>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        <nav
          className="lg:w-52 flex-shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0"
          aria-label="Admin sections"
        >
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-medium text-left whitespace-nowrap transition-colors touch-manipulation focus-visible:outline-none ${
                section === item.id
                  ? "bg-[var(--bg-subtle)] text-[var(--fg)] border border-[var(--border)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-subtle)]/60 border border-transparent"
              }`}
            >
              <span>{item.label}</span>
              {item.id === "review" && pendingCount > 0 && (
                <span className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
