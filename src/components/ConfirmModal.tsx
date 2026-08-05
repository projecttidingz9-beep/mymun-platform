"use client";

import { ReactNode, useEffect, useState } from "react";

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  /** Optional review step content shown between description and confirm controls. */
  preview?: ReactNode;
  /** When set, the user must type this exact text before the confirm button is enabled. */
  requireTypedText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

/**
 * Two-step confirmation modal for important actions:
 * 1) Review the action (and optional preview details)
 * 2) Explicitly click Confirm (and type a phrase for the most destructive ones)
 */
export default function ConfirmModal({
  open,
  title,
  description,
  preview,
  requireTypedText,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [typedText, setTypedText] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset modal fields when closed
      setTypedText("");
      setConfirming(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, confirming]);

  if (!open) return null;

  const typedOk = !requireTypedText || typedText.trim() === requireTypedText;
  const wide = Boolean(preview);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)" }}
        aria-label="Close dialog"
        disabled={confirming}
        onClick={() => {
          if (!confirming) onClose();
        }}
      />
      <div
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl flex flex-col`}
      >
        <div className="p-5 sm:p-6 border-b border-[var(--border)]">
          <h2 id="confirm-modal-title" className="text-lg font-bold text-[var(--fg)]">
            {title}
          </h2>
          {description && (
            <p className="text-sm mt-2 text-[var(--fg-muted)]">{description}</p>
          )}
        </div>

        {preview ? (
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">{preview}</div>
        ) : null}

        {requireTypedText && (
          <div className="px-5 sm:px-6 pb-2">
            <label className="text-xs font-semibold text-[var(--fg-muted)]">
              Type &ldquo;{requireTypedText}&rdquo; to confirm
            </label>
            <input
              className="input-base text-sm mt-1 w-full"
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              disabled={confirming}
              autoFocus={!preview}
            />
          </div>
        )}

        <div className="p-5 sm:p-6 border-t border-[var(--border)] flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost text-sm min-h-[44px] touch-manipulation w-full sm:w-auto"
            disabled={confirming}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              danger
                ? "btn btn-danger text-sm min-h-[44px] touch-manipulation w-full sm:w-auto"
                : "btn btn-primary text-sm min-h-[44px] touch-manipulation w-full sm:w-auto"
            }
            disabled={!typedOk || confirming}
            style={!typedOk || confirming ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            onClick={() => {
              if (!typedOk || confirming) return;
              setConfirming(true);
              void Promise.resolve(onConfirm())
                .then(() => onClose())
                .catch((error) => {
                  console.error("[ConfirmModal] onConfirm failed", error);
                })
                .finally(() => setConfirming(false));
            }}
          >
            {confirming ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ConfirmPreviewRow = {
  label: string;
  value: string;
};

/** Compact detail rows for step-1 preview panes. */
export function ConfirmPreviewDetails({
  rows,
  note,
}: {
  rows: ConfirmPreviewRow[];
  note?: string;
}) {
  return (
    <div className="space-y-3">
      <div
        className="rounded-xl p-3 space-y-2"
        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
      >
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex items-start justify-between gap-3">
            <span className="text-xs font-semibold shrink-0" style={{ color: "var(--fg-muted)" }}>
              {row.label}
            </span>
            <span className="text-sm text-right" style={{ color: "var(--fg)" }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {note ? (
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

export type DestructiveConfirmButtonProps = {
  label: string;
  confirmTitle: string;
  confirmDescription?: string;
  preview?: ReactNode;
  requireTypedText?: string;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

/** Small wrapper: renders a trigger button + its own ConfirmModal. */
export function DestructiveConfirmButton({
  label,
  confirmTitle,
  confirmDescription,
  preview,
  requireTypedText,
  confirmLabel,
  className,
  disabled,
  danger = true,
  onConfirm,
}: DestructiveConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className ?? "btn btn-danger-ghost text-xs min-h-[44px] touch-manipulation"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <ConfirmModal
        open={open}
        title={confirmTitle}
        description={confirmDescription}
        preview={preview}
        requireTypedText={requireTypedText}
        confirmLabel={confirmLabel ?? "Yes, delete"}
        danger={danger}
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
