"use client";

import type { AdminStatsPayload } from "./types";

type AdminOverviewProps = {
  stats: AdminStatsPayload | null;
  loading: boolean;
  error: string | null;
};

export default function AdminOverview({ stats, loading, error }: AdminOverviewProps) {
  if (loading) {
    return <p className="text-[var(--fg-muted)]">Loading stats…</p>;
  }
  if (error) {
    return <p className="text-rose-600 dark:text-rose-400">{error}</p>;
  }
  if (!stats) return null;

  return (
    <section className="space-y-6" aria-label="Overview">
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
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--fg)]">{card.value}</p>
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

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">Recent users</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {stats.recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 text-[var(--fg)]">{u.name}</td>
                  <td className="py-2 text-[var(--fg-muted)]">{u.email}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-xs">{u.role}</span>
                  </td>
                  <td className="py-2 text-[var(--fg-muted)] text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
