"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminEventListRow } from "./types";

function statusBadgeClass(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "REVIEW":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30";
    case "DRAFT":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-200 border-zinc-500/25";
    case "CANCELLED":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30";
    default:
      return "bg-[var(--bg-subtle)] text-[var(--fg)] border-[var(--border)]";
  }
}

export default function AdminEventsTable() {
  const [events, setEvents] = useState<AdminEventListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/events?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setError(res.status === 403 ? "Access denied." : "Failed to load conferences.");
        setEvents([]);
        return;
      }
      const data = (await res.json()) as { events?: AdminEventListRow[] };
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setError("Failed to load conferences.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <section className="space-y-4" aria-label="All conferences">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="all-search" className="text-xs text-[var(--fg-muted)]">
            Search title
          </label>
          <input
            id="all-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="status-filter" className="text-xs text-[var(--fg-muted)]">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm min-h-[44px]"
          >
            <option value="">All</option>
            <option value="DRAFT">DRAFT</option>
            <option value="REVIEW">REVIEW</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="ARCHIVED">ARCHIVED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="btn btn-primary w-full min-h-[44px] touch-manipulation"
            onClick={() => void loadEvents()}
          >
            Apply filters
          </button>
        </div>
      </div>
      {loading && <p className="text-[var(--fg-muted)]">Loading…</p>}
      {error && <p className="text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Conference</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Organizer</th>
              <th className="px-4 py-3 font-medium">Regs</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {events.map((row) => (
              <tr key={row.id} className="bg-[var(--bg-elevated)]">
                <td className="px-4 py-3 font-medium text-[var(--fg)]">{row.title}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(row.status)}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">
                  {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{row.owner?.email ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{row._count.registrations}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)] whitespace-nowrap text-xs">
                  {new Date(row.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                  No conferences match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
