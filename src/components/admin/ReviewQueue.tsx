"use client";

import { useCallback, useEffect, useState } from "react";
import ReviewDetail from "./ReviewDetail";
import type { AdminEventListRow } from "./types";

type ReviewQueueProps = {
  onPendingCountChange?: (count: number) => void;
};

export default function ReviewQueue({ onPendingCountChange }: ReviewQueueProps) {
  const [events, setEvents] = useState<AdminEventListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: "REVIEW" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/events?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setError(res.status === 403 ? "Access denied." : "Failed to load queue.");
        setEvents([]);
        onPendingCountChange?.(0);
        return;
      }
      const data = (await res.json()) as { events?: AdminEventListRow[] };
      const list = Array.isArray(data.events) ? data.events : [];
      setEvents(list);
      onPendingCountChange?.(list.length);
      setSelectedId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setError("Failed to load queue.");
      setEvents([]);
      onPendingCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [search, onPendingCountChange]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  return (
    <section className="space-y-4" aria-label="Review queue">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="flex-1 min-w-0 max-w-md">
          <label htmlFor="queue-search" className="text-xs text-[var(--fg-muted)]">
            Search pending submissions
          </label>
          <input
            id="queue-search"
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
          onClick={() => void loadQueue()}
        >
          Refresh
        </button>
      </div>

      <p className="text-sm text-[var(--fg-muted)]">
        Conferences awaiting approval before they appear on the marketplace.
        {loading ? " Loading…" : ` ${events.length} pending.`}
      </p>

      {error && <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
          {!loading && events.length === 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 text-center">
              <p className="text-sm font-medium text-[var(--fg)]">Queue is clear</p>
              <p className="text-sm text-[var(--fg-muted)] mt-1">No conferences are waiting for review.</p>
            </div>
          )}
          {events.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedId(row.id)}
              className={`w-full text-left rounded-2xl border p-4 transition-colors touch-manipulation focus-visible:outline-none ${
                selectedId === row.id
                  ? "border-[var(--blue)] bg-[var(--bg-subtle)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--fg-muted)]"
              }`}
            >
              <div className="flex gap-3">
                {row.coverImageUrl ? (
                  <div
                    className="w-16 h-16 rounded-lg flex-shrink-0 bg-cover bg-center border border-[var(--border)]"
                    style={{ backgroundImage: `url(${row.coverImageUrl})` }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg flex-shrink-0 bg-[var(--bg-subtle)] border border-[var(--border)]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--fg)] truncate">{row.title}</p>
                  <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                    {row.owner?.email ?? "Unknown organizer"}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)] mt-1">
                    {[row.city, row.country].filter(Boolean).join(", ")} · {row.committeeCount} committees
                  </p>
                  {row.submittedAt && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Submitted {new Date(row.submittedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <ReviewDetail
          eventId={selectedId}
          onModerated={() => void loadQueue()}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </section>
  );
}
