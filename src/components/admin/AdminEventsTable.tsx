"use client";

import { useCallback, useEffect, useState } from "react";
import ModerationModal from "./ModerationModal";
import type { AdminEventListRow } from "./types";

function statusBadgeClass(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "REVIEW":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30";
    case "DRAFT":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-200 border-zinc-500/25";
    case "SUSPENDED":
      return "bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/30";
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
  const [deleteTarget, setDeleteTarget] = useState<AdminEventListRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const [suspendBusyId, setSuspendBusyId] = useState<string | null>(null);

  const toggleSuspend = async (row: AdminEventListRow) => {
    const action = row.status === "SUSPENDED" ? "unsuspend" : "suspend";
    setSuspendBusyId(row.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(row.id)}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionMessage(payload.error || "Action failed.");
        return;
      }
      setActionMessage(
        action === "suspend" ? `"${row.title}" suspended and hidden.` : `"${row.title}" unsuspended and republished.`
      );
      await loadEvents();
    } catch {
      setActionMessage("Could not reach server.");
    } finally {
      setSuspendBusyId(null);
    }
  };

  const deleteConference = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionMessage(payload.error || "Delete failed.");
        return;
      }
      setDeleteTarget(null);
      setActionMessage(`"${deleteTarget.title}" removed from marketplace.`);
      await loadEvents();
    } catch {
      setActionMessage("Could not reach server.");
    } finally {
      setDeleteBusy(false);
    }
  };

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
            <option value="SUSPENDED">SUSPENDED</option>
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
      {actionMessage && (
        <p
          className={`text-sm ${actionMessage.includes("failed") || actionMessage.includes("Could not") ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-300"}`}
          role="status"
        >
          {actionMessage}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Conference</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Organizer</th>
              <th className="px-4 py-3 font-medium">Regs</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Actions</th>
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
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(row.status === "PUBLISHED" || row.status === "SUSPENDED") && (
                      <button
                        type="button"
                        className="btn btn-ghost text-xs min-h-[36px] touch-manipulation"
                        disabled={suspendBusyId === row.id}
                        onClick={() => void toggleSuspend(row)}
                      >
                        {row.status === "SUSPENDED" ? "Unsuspend" : "Suspend"}
                      </button>
                    )}
                    {row.status === "PUBLISHED" && (
                      <button
                        type="button"
                        className="btn btn-danger-ghost text-xs min-h-[36px] touch-manipulation"
                        onClick={() => setDeleteTarget(row)}
                      >
                        Delete
                      </button>
                    )}
                    {row.status !== "PUBLISHED" && row.status !== "SUSPENDED" && (
                      <span className="text-xs text-[var(--fg-muted)]">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                  No conferences match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModerationModal
        open={!!deleteTarget}
        title="Remove from marketplace?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be soft-deleted and hidden from the marketplace. Registrations are preserved in the database.`
            : ""
        }
        confirmLabel="Delete conference"
        confirmVariant="danger"
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteConference()}
      />
    </section>
  );
}
