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

function formatMoneyInr(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    value
  );
}

export default function ReviewDetail({ eventId, onModerated, onClose }: ReviewDetailProps) {
  const [detail, setDetail] = useState<AdminReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showFullForm, setShowFullForm] = useState(false);
  const [invoiceFileName, setInvoiceFileName] = useState("");
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [deleteOrganizerOpen, setDeleteOrganizerOpen] = useState(false);
  const [deleteOrganizerBusy, setDeleteOrganizerBusy] = useState(false);

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

  const toggleSuspend = async () => {
    if (!eventId || !detail) return;
    const action = detail.event.status === "SUSPENDED" ? "unsuspend" : "suspend";
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(payload.error || "Action failed.");
        return;
      }
      setSuspendOpen(false);
      setToast(action === "suspend" ? "Conference suspended and hidden from the marketplace." : "Conference unsuspended and republished.");
      onModerated();
      await loadDetail();
    } catch {
      setToast("Could not reach server.");
    } finally {
      setBusy(false);
    }
  };

  const saveInvoiceTemplate = async (payload: { url: string; fileName?: string }) => {
    if (!eventId) return;
    setInvoiceSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/invoice-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(body.error || "Could not save invoice template.");
        return;
      }
      setToast(payload.url ? "Invoice template saved." : "Invoice template cleared.");
      setInvoiceFileName("");
      await loadDetail();
    } catch {
      setToast("Could not reach server.");
    } finally {
      setInvoiceSaving(false);
    }
  };

  const deleteOrganizerAccount = async () => {
    if (!detail?.organizer.email) return;
    setDeleteOrganizerBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/organizers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: detail.organizer.email }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(payload.error || "Could not delete organizer account.");
        return;
      }
      setDeleteOrganizerOpen(false);
      setToast(`Organizer account (${detail.organizer.email}) deleted.`);
      onModerated();
      onClose();
    } catch {
      setToast("Could not reach server.");
    } finally {
      setDeleteOrganizerBusy(false);
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
              {detail.organizer.contactDetail && (
                <dd className="text-[var(--fg)] mt-1">
                  <span className="text-[var(--fg-muted)]">Contact: </span>
                  {detail.organizer.contactDetail}
                </dd>
              )}
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

          <button
            type="button"
            className="text-xs font-semibold text-[var(--blue)]"
            onClick={() => setShowFullForm((prev) => !prev)}
          >
            {showFullForm ? "Hide full application form ▲" : "View full application form ▼"}
          </button>
          {showFullForm && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              {[
                ["Conference name", detail.applicationForm.title],
                ["Organizing body", detail.applicationForm.organizerName],
                ["Contact detail", detail.applicationForm.contactDetail || "—"],
                ["Owner account email", detail.applicationForm.ownerEmail || "—"],
                ["City", detail.applicationForm.city],
                ["Country", detail.applicationForm.country],
                ["Venue", detail.applicationForm.venue || "—"],
                ["Level", detail.applicationForm.level],
                ["Approximate capacity", String(detail.applicationForm.capacity)],
                ["Currency", detail.applicationForm.currency || "—"],
                ["Start date", new Date(detail.applicationForm.startDate).toLocaleDateString()],
                ["End date", new Date(detail.applicationForm.endDate).toLocaleDateString()],
                ["Registration deadline", detail.applicationForm.registrationDeadline || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[var(--fg-muted)]">{label}</dt>
                  <dd className="text-[var(--fg)]">{value}</dd>
                </div>
              ))}
              {detail.applicationForm.description && (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--fg-muted)]">Description</dt>
                  <dd className="text-[var(--fg)] whitespace-pre-wrap">{detail.applicationForm.description}</dd>
                </div>
              )}
              {detail.applicationForm.termsAndConditions && (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--fg-muted)]">Terms & conditions</dt>
                  <dd className="text-[var(--fg)] whitespace-pre-wrap">{detail.applicationForm.termsAndConditions}</dd>
                </div>
              )}
              {detail.applicationForm.refundPolicy && (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--fg-muted)]">Refund policy</dt>
                  <dd className="text-[var(--fg)] whitespace-pre-wrap">{detail.applicationForm.refundPolicy}</dd>
                </div>
              )}
              {detail.applicationForm.codeOfConduct && (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--fg-muted)]">Code of conduct</dt>
                  <dd className="text-[var(--fg)] whitespace-pre-wrap">{detail.applicationForm.codeOfConduct}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">Review panel</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-[var(--fg-muted)]">Registration status</dt>
                <dd className={detail.review.registrationOpen ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-[var(--fg-muted)] font-medium"}>
                  {detail.review.registrationOpen ? "Open" : "Closed"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--fg-muted)]">Registered</dt>
                <dd className="tabular-nums text-[var(--fg)]">{detail.review.registeredCount} ({detail.review.paidCount} paid)</dd>
              </div>
              <div>
                <dt className="text-[var(--fg-muted)]">Revenue collected</dt>
                <dd className="tabular-nums text-[var(--fg)]">{formatMoneyInr(detail.review.revenueCollected)}</dd>
              </div>
              <div>
                <dt className="text-[var(--fg-muted)]">Platform cut ({Math.round(detail.review.platformFeeRate * 100)}%)</dt>
                <dd className="tabular-nums text-[var(--fg)]">{formatMoneyInr(detail.review.platformCut)}</dd>
              </div>
              <div>
                <dt className="text-[var(--fg-muted)]">Organizer net payout</dt>
                <dd className="tabular-nums text-[var(--fg)]">{formatMoneyInr(detail.review.organizerNetPayout)}</dd>
              </div>
            </div>
            <div className="pt-2 border-t border-[var(--border)]">
              <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-1">Organizer bank details</p>
              {detail.bankingDetails ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-[var(--fg-muted)]">Account holder</dt><dd className="text-[var(--fg)]">{detail.bankingDetails.accountHolderName || "—"}</dd></div>
                  <div><dt className="text-[var(--fg-muted)]">Bank</dt><dd className="text-[var(--fg)]">{detail.bankingDetails.bankName || "—"}</dd></div>
                  <div><dt className="text-[var(--fg-muted)]">Account number</dt><dd className="text-[var(--fg)] font-mono">{detail.bankingDetails.accountNumber || "—"}</dd></div>
                  <div><dt className="text-[var(--fg-muted)]">IFSC</dt><dd className="text-[var(--fg)] font-mono">{detail.bankingDetails.ifscCode || "—"}</dd></div>
                  <div><dt className="text-[var(--fg-muted)]">UPI</dt><dd className="text-[var(--fg)]">{detail.bankingDetails.upiId || "—"}</dd></div>
                </dl>
              ) : (
                <p className="text-sm text-[var(--fg-muted)]">Organizer has not added payout bank details yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">Invoice template</p>
            {detail.invoiceTemplate.url ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-[var(--fg)]">{detail.invoiceTemplate.fileName || "Custom template configured"}</p>
                <button
                  type="button"
                  className="btn btn-danger-ghost text-xs min-h-[36px]"
                  disabled={invoiceSaving}
                  onClick={() => void saveInvoiceTemplate({ url: "" })}
                >
                  Clear
                </button>
              </div>
            ) : (
              <p className="text-sm text-[var(--fg-muted)]">No invoice template configured — the default platform template will be used.</p>
            )}
            <input
              type="file"
              accept=".pdf,.html,.htm,.png,.jpg,.jpeg"
              className="text-xs"
              disabled={invoiceSaving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setInvoiceFileName(file.name);
                const reader = new FileReader();
                reader.onload = () => {
                  const result = typeof reader.result === "string" ? reader.result : "";
                  if (!result) return;
                  void saveInvoiceTemplate({ url: result, fileName: file.name });
                };
                reader.readAsDataURL(file);
              }}
            />
            {invoiceFileName && <p className="text-xs text-[var(--fg-muted)]">Uploading {invoiceFileName}…</p>}
          </div>

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
            {(detail.event.status === "PUBLISHED" || detail.event.status === "SUSPENDED") && (
              <button
                type="button"
                className="btn btn-ghost text-sm min-h-[44px] touch-manipulation"
                disabled={busy}
                onClick={() => setSuspendOpen(true)}
              >
                {detail.event.status === "SUSPENDED" ? "Unsuspend & republish" : "Suspend (hide, keep data)"}
              </button>
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

          {detail.organizer.email && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
              <p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-1">Danger zone</p>
              <p className="text-sm text-[var(--fg-muted)] mb-2">
                Permanently delete the organizer account ({detail.organizer.email}) — typically only after they&apos;ve
                emailed requesting deletion and own no active conferences.
              </p>
              <button
                type="button"
                className="btn btn-danger-ghost text-sm min-h-[44px] touch-manipulation"
                onClick={() => setDeleteOrganizerOpen(true)}
              >
                Delete organizer account
              </button>
            </div>
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
        open={deleteOrganizerOpen}
        title="Permanently delete this organizer account?"
        description={`This deletes the account for ${detail?.organizer.email ?? "this organizer"} entirely and cannot be undone. It will fail if they still own any active conference.`}
        confirmLabel="Delete organizer account"
        confirmVariant="danger"
        busy={deleteOrganizerBusy}
        onClose={() => setDeleteOrganizerOpen(false)}
        onConfirm={() => void deleteOrganizerAccount()}
      />

      <ModerationModal
        open={suspendOpen}
        title={detail?.event.status === "SUSPENDED" ? "Unsuspend and republish?" : "Suspend this conference?"}
        description={
          detail?.event.status === "SUSPENDED"
            ? `"${detail?.event.title ?? "This conference"}" will become visible on the marketplace again.`
            : `"${detail?.event.title ?? "This conference"}" will be immediately hidden from the marketplace. All data (registrations, revenue, committees) is preserved and this can be reversed at any time — use this instead of Delete when you just need to pause a listing.`
        }
        confirmLabel={detail?.event.status === "SUSPENDED" ? "Unsuspend & republish" : "Suspend conference"}
        confirmVariant={detail?.event.status === "SUSPENDED" ? "primary" : "danger"}
        busy={busy}
        onClose={() => setSuspendOpen(false)}
        onConfirm={() => void toggleSuspend()}
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
