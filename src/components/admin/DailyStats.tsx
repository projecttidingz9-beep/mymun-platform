"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminDailyStatsPayload } from "./types";

function formatMoneyInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getTodayDateInputValue(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default function DailyStats() {
  const [date, setDate] = useState(getTodayDateInputValue);
  const [data, setData] = useState<AdminDailyStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date });
      const res = await fetch(`/api/admin/daily-stats?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setError(res.status === 403 ? "Access denied." : "Failed to load daily stats.");
        setData(null);
        return;
      }
      setData((await res.json()) as AdminDailyStatsPayload);
    } catch {
      setError("Failed to load daily stats.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <section className="space-y-4" aria-label="Daily registration stats">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 space-y-2">
        <h2 className="text-lg font-semibold text-[var(--fg)]">Daily registration stats</h2>
        <p className="text-sm text-[var(--fg-muted)]">
          View registrations created on a specific day (IST), grouped by conference. Amounts include
          only paid registrations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
        <div>
          <label htmlFor="daily-stats-date" className="text-xs text-[var(--fg-muted)]">
            Date (IST)
          </label>
          <input
            id="daily-stats-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary min-h-[44px] touch-manipulation"
          onClick={() => void loadStats()}
        >
          Load stats
        </button>
      </div>

      {loading && <p className="text-[var(--fg-muted)]">Loading…</p>}
      {error && <p className="text-rose-600 dark:text-rose-400">{error}</p>}

      {data && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-xs text-[var(--fg-muted)]">Registrations</p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--fg)]">
                {data.totals.registrationCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-xs text-[var(--fg-muted)]">Paid</p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--fg)]">
                {data.totals.paidCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-xs text-[var(--fg-muted)]">Amount collected</p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--fg)]">
                {formatMoneyInr(data.totals.amountCollected)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-xs text-[var(--fg-muted)]">Platform cut (6%)</p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--fg)]">
                {formatMoneyInr(data.totals.platformCut)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-xs text-[var(--fg-muted)]">Organizer net</p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--fg)]">
                {formatMoneyInr(data.totals.organizerNet)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="min-w-[1080px] w-full text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Conference</th>
                  <th className="px-4 py-3 font-medium">Organizer email</th>
                  <th className="px-4 py-3 font-medium">Registrations</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Amount collected</th>
                  <th className="px-4 py-3 font-medium">Platform cut</th>
                  <th className="px-4 py-3 font-medium">Organizer net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.rows.map((row) => (
                  <tr key={row.eventId} className="bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 font-medium text-[var(--fg)]">{row.eventTitle}</td>
                    <td className="px-4 py-3 text-[var(--fg-muted)]">{row.organizerEmail ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{row.registrationCount}</td>
                    <td className="px-4 py-3 tabular-nums">{row.paidCount}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoneyInr(row.amountCollected)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoneyInr(row.platformCut)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoneyInr(row.organizerNet)}</td>
                  </tr>
                ))}
                {data.rows.length > 0 && (
                  <tr className="bg-[var(--bg-subtle)] font-semibold">
                    <td className="px-4 py-3 text-[var(--fg)]" colSpan={2}>
                      Total for {new Date(`${data.date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                      })}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{data.totals.registrationCount}</td>
                    <td className="px-4 py-3 tabular-nums">{data.totals.paidCount}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMoneyInr(data.totals.amountCollected)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatMoneyInr(data.totals.platformCut)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoneyInr(data.totals.organizerNet)}</td>
                  </tr>
                )}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                      No registrations were created on this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
