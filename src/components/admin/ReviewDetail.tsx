"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ModerationModal from "./ModerationModal";
import type { AdminReviewDetail } from "./types";

type ReviewDetailProps = {
  eventId: string | null;
  onModerated: () => void;
  onClose: () => void;
};

export default function ReviewDetail({ eventId, onModerated, onClose }: ReviewDetailProps) {
  const [detail, setDetail] = useState<AdminReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const loadDetail = useCallback(async () => {
    if (!eventId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setError(res.status === 403 ? "Access denied." : "Failed to load submission.");
        setDetail(null);
        return;
      }
      setDetail((await res.json()) as AdminReviewDetail);
    } catch {
      setError("Failed to load submission.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const moderate = async (action: "approve" | "reject", note?: string) => {
    if (!eventId) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, note }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(payload.error || "Action failed.");
        return;
      }
      setApproveOpen(false);
      setRejectOpen(false);
      setRejectNote("");
      if (action === "approve") {
        setToast("Conference published to marketplace. You can delete it below if this was a mistake.");
        onModerated();
        await loadDetail();
      } else {
        setToast("Returned to organizer as Draft.");
        onModerated();
        onClose();
      }
    } catch {
      setToast("Could not reach server.");
    } finally {
      setBusy(false);
    }
  };

  const deleteConference = async () => {
    if (!eventId) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(payload.error || "Delete failed.");
        return;
      }
      setDeleteOpen(false);
      setToast("Conference removed from marketplace.");
      onModerated();
      onClose();
    } catch {
      setToast("Could not reach server.");
    } finally {
      setBusy(false);
    }
  };

  if (!eventId) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-subtle)]/40 p-8 text-center">
        <p className="text-sm text-[var(--fg-muted)]">Select a submission from the queue to review details.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--fg)]">Submission review</h2>
        <button
          type="button"
          className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] min-h-[36px] px-2"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {loading && <p className="p-6 text-sm text-[var(--fg-muted)]">Loading…</p>}
      {error && <p className="p-6 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {detail && !loading && (
        <div className="p-6 space-y-5">
          {detail.event.coverImageUrl && (
            <div
              className="h-36 rounded-xl bg-cover bg-center border border-[var(--border)]"
              style={{ backgroundImage: `url(${detail.event.coverImageUrl})` }}
              role="img"
              aria-label="Conference banner"
            />
          )}

          <div>
            <h3 className="text-xl font-semibold text-[var(--fg)]">{detail.event.title}</h3>
            <p className="text-xs text-[var(--fg-muted)] font-mono mt-1">{detail.event.id}</p>
            {detail.event.submittedAt && (
              <p className="text-xs text-[var(--fg-muted)] mt-2">
                Submitted {new Date(detail.event.submittedAt).toLocaleString()}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--fg-muted)]">Organizer</dt>
              <dd className="font-medium text-[var(--fg)]">{detail.organizer.name}</dd>
              <dd className="text-[var(--fg-muted)]">{detail.organizer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Location</dt>
              <dd className="text-[var(--fg)]">
                {[detail.summary.city, detail.summary.country].filter(Boolean).join(", ") || "—"}
              </dd>
              {detail.summary.venue && (
                <dd className="text-[var(--fg-muted)]">{detail.summary.venue}</dd>
              )}
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Dates</dt>
              <dd className="text-[var(--fg)]">
                {new Date(detail.event.startDate).toLocaleDateString()} –{" "}
                {new Date(detail.event.endDate).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Level / capacity</dt>
              <dd className="text-[var(--fg)]">
                {detail.summary.level} · {detail.summary.capacity} delegates
              </dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Committees</dt>
              <dd className="tabular-nums text-[var(--fg)]">{detail.summary.committeeCount}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Registration categories</dt>
              <dd className="tabular-nums text-[var(--fg)]">{detail.summary.categoryCount}</dd>
            </div>
          </dl>

          {detail.summary.description && (
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-1">Description</p>
              <p className="text-sm text-[var(--fg)] line-clamp-6 whitespace-pre-wrap">
                {detail.summary.description}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/admin/review/${encodeURIComponent(detail.event.id)}`}
              className="btn btn-ghost text-sm min-h-[44px] touch-manipulation"
            >
              Full preview
            </Link>
            {detail.event.status === "REVIEW" && (
              <>
                <button
                  type="button"
                  className="btn btn-primary text-sm min-h-[44px] touch-manipulation"
                  disabled={busy}
                  onClick={() => setApproveOpen(true)}
                >
                  Approve & publish
                </button>
                <button
                  type="button"
                  className="btn btn-danger-ghost text-sm min-h-[44px] touch-manipulation"
                  disabled={busy}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </button>
              </>
            )}
            {detail.event.status === "PUBLISHED" && (
              <button
                type="button"
                className="btn btn-danger-ghost text-sm min-h-[44px] touch-manipulation"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                Delete conference
              </button>
            )}
          </div>

          {toast && (
            <p
              className={`text-sm ${toast.includes("failed") || toast.includes("Could not") ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-300"}`}
              role="status"
            >
              {toast}
            </p>
          )}
        </div>
      )}

      <ModerationModal
        open={approveOpen}
        title="Publish to marketplace?"
        description={`"${detail?.event.title ?? "This conference"}" will be visible to all delegates on the marketplace.`}
        confirmLabel="Approve & publish"
        busy={busy}
        onClose={() => setApproveOpen(false)}
        onConfirm={() => void moderate("approve")}
      />

      <ModerationModal
        open={deleteOpen}
        title="Remove from marketplace?"
        description={`"${detail?.event.title ?? "This conference"}" will be soft-deleted and hidden from the marketplace. This cannot be undone from the dashboard.`}
        confirmLabel="Delete conference"
        confirmVariant="danger"
        busy={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteConference()}
      />

      <ModerationModal
        open={rejectOpen}
        title="Return to organizer?"
        description="The conference will move back to Draft so the organizer can edit and submit again."
        confirmLabel="Reject & return to Draft"
        confirmVariant="danger"
        busy={busy}
        onClose={() => setRejectOpen(false)}
        onConfirm={() => void moderate("reject", rejectNote)}
      >
        <label htmlFor="reject-note" className="block text-xs text-[var(--fg-muted)]">
          Feedback for organizer (optional)
        </label>
        <textarea
          id="reject-note"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm min-h-[88px]"
          placeholder="Explain what needs to change before approval…"
        />
      </ModerationModal>
    </div>
  );
}
