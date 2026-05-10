"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Tab = "overview" | "pending" | "all" | "users";

type AdminStatsPayload = {
  totals: {
    users: number;
    events: number;
    registrations: number;
    signupsLast30Days: number;
  };
  usersByRole: Record<string, number>;
  eventsByStatus: Record<string, number>;
  registrationsByStatus: Record<string, number>;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  }>;
};

type AdminEventRow = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  owner: { email: string | null; name: string } | null;
  _count: { registrations: number };
};

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "pending", label: "Pending review" },
  { id: "all", label: "All conferences" },
  { id: "users", label: "Recent users" },
];

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
    case "ARCHIVED":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-500/25";
    default:
      return "bg-[var(--bg-subtle)] text-[var(--fg)] border-[var(--border)]";
  }
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStatsPayload | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setStatsError(res.status === 403 ? "Access denied." : "Failed to load stats.");
        setStats(null);
        return;
      }
      const data = (await res.json()) as AdminStatsPayload;
      setStats(data);
    } catch {
      setStatsError("Failed to load stats.");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const params = new URLSearchParams();
      if (tab === "pending") {
        params.set("status", "REVIEW");
      } else if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/events?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setEventsError(res.status === 403 ? "Access denied." : "Failed to load conferences.");
        setEvents([]);
        return;
      }
      const data = (await res.json()) as { events?: AdminEventRow[] };
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setEventsError("Failed to load conferences.");
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [tab, search, statusFilter]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "pending" || tab === "all") {
      void loadEvents();
    }
  }, [tab, loadEvents]);

  const updateEventStatus = async (eventId: string, status: "PUBLISHED" | "CANCELLED" | "ARCHIVED") => {
    setActionBusy(eventId);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error || "Update failed.");
        return;
      }
      await loadStats();
      await loadEvents();
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--fg-muted)]">Platform</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--fg)]">
          Super admin
        </h1>
        <p className="text-sm sm:text-base text-[var(--fg-muted)] max-w-2xl">
          Review organizer submissions, publish conferences to the marketplace, and monitor platform
          stats. Only your configured admin account can view this page.
        </p>
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-[var(--blue)] hover:underline focus-visible:outline-none"
        >
          Back to home
        </Link>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 min-h-[44px] rounded-t-xl text-sm font-medium transition-colors touch-manipulation focus-visible:outline-none ${
              tab === t.id
                ? "bg-[var(--bg-subtle)] text-[var(--fg)] border border-b-0 border-[var(--border)] -mb-px"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)] border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="space-y-6" aria-label="Overview">
          {statsLoading && <p className="text-[var(--fg-muted)]">Loading stats…</p>}
          {statsError && <p className="text-rose-600 dark:text-rose-400">{statsError}</p>}
          {stats && !statsLoading && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "Total users", value: stats.totals.users },
                  { label: "Total conferences", value: stats.totals.events },
                  { label: "Total registrations", value: stats.totals.registrations },
                  { label: "Sign-ups (30 days)", value: stats.totals.signupsLast30Days },
                  { label: "Pending review", value: stats.eventsByStatus.REVIEW ?? 0 },
                  { label: "Published", value: stats.eventsByStatus.PUBLISHED ?? 0 },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--fg)]">
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
                  <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">Users by role</h2>
                  <ul className="space-y-2 text-sm">
                    {Object.entries(stats.usersByRole).map(([role, n]) => (
                      <li key={role} className="flex justify-between gap-4">
                        <span className="text-[var(--fg-muted)]">{role}</span>
                        <span className="font-medium tabular-nums">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
                  <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">Registrations by status</h2>
                  <ul className="space-y-2 text-sm">
                    {Object.entries(stats.registrationsByStatus).map(([s, n]) => (
                      <li key={s} className="flex justify-between gap-4">
                        <span className="text-[var(--fg-muted)]">{s}</span>
                        <span className="font-medium tabular-nums">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "pending" && (
        <section className="space-y-4" aria-label="Pending review">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 min-w-0">
              <label htmlFor="pending-search" className="text-xs text-[var(--fg-muted)]">
                Search title
              </label>
              <input
                id="pending-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm min-h-[44px]"
                placeholder="Filter by title…"
              />
            </div>
            <button
              type="button"
              className="btn btn-primary min-h-[44px] touch-manipulation"
              onClick={() => void loadEvents()}
            >
              Refresh
            </button>
          </div>
          <p className="text-sm text-[var(--fg-muted)]">
            Showing conferences with status <strong>REVIEW</strong> (organizers submitted for approval).
            {eventsLoading && " Loading…"}
          </p>
          {eventsError && <p className="text-rose-600 dark:text-rose-400">{eventsError}</p>}
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Conference</th>
                  <th className="px-4 py-3 font-medium">Organizer</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Regs</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {events.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 font-medium text-[var(--fg)]">
                      <div className="min-w-0">{row.title}</div>
                      <div className="text-xs text-[var(--fg-muted)] font-mono truncate">{row.id}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--fg-muted)]">
                      {row.owner?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--fg-muted)] whitespace-nowrap">
                      {new Date(row.startDate).toLocaleDateString()} –{" "}
                      {new Date(row.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row._count.registrations}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionBusy === row.id}
                          className="btn btn-primary text-xs px-3 py-2 min-h-[40px] touch-manipulation"
                          onClick={() => void updateEventStatus(row.id, "PUBLISHED")}
                        >
                          Approve & publish
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy === row.id}
                          className="btn btn-danger-ghost text-xs px-3 py-2 min-h-[40px] touch-manipulation"
                          onClick={() => void updateEventStatus(row.id, "CANCELLED")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!eventsLoading && events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                      No conferences pending review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "all" && (
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
          {eventsError && <p className="text-rose-600 dark:text-rose-400">{eventsError}</p>}
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Conference</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Organizer</th>
                  <th className="px-4 py-3 font-medium">Regs</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {events.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 font-medium text-[var(--fg)]">
                      <div className="min-w-0">{row.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--fg-muted)]">{row.owner?.email ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{row._count.registrations}</td>
                    <td className="px-4 py-3 text-[var(--fg-muted)] whitespace-nowrap text-xs">
                      {new Date(row.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!eventsLoading && events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                      No conferences match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="space-y-4" aria-label="Recent users">
          {statsLoading && <p className="text-[var(--fg-muted)]">Loading…</p>}
          {statsError && <p className="text-rose-600 dark:text-rose-400">{statsError}</p>}
          {stats && (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="min-w-[640px] w-full text-sm">
                <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {stats.recentUsers.map((u) => (
                    <tr key={u.id} className="bg-[var(--bg-elevated)]">
                      <td className="px-4 py-3 text-[var(--fg)]">{u.name}</td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-xs">{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)] whitespace-nowrap text-xs">
                        {new Date(u.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
