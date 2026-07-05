"use client";

import { useEffect, useState } from "react";

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  /** When set, the user must type this exact text before the confirm button is enabled (extra safety for the most destructive actions). */
  requireTypedText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

/**
 * A real, opaque, double-confirmation modal used for every destructive/important action
 * across the app. Step 1: the dialog itself is a confirmation. Step 2 (this component):
 * the user must explicitly click the confirm button again (and, for the most sensitive
 * actions, type a confirmation phrase) before anything happens.
 */
export default function ConfirmModal({
  open,
  title,
  description,
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

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Solid, fully opaque backdrop — never transparent/unstyled. */}
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
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--bg-elevated, #101014)", border: "1px solid var(--border)" }}
      >
        <h2 id="confirm-modal-title" className="text-lg font-bold" style={{ color: "var(--fg)" }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
            {description}
          </p>
        )}
        {requireTypedText && (
          <div className="mt-4">
            <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
              Type &ldquo;{requireTypedText}&rdquo; to confirm
            </label>
            <input
              className="input-base text-sm mt-1 w-full"
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              disabled={confirming}
              autoFocus
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={confirming}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "btn btn-danger text-sm" : "btn btn-primary text-sm"}
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

export type DestructiveConfirmButtonProps = {
  label: string;
  confirmTitle: string;
  confirmDescription?: string;
  requireTypedText?: string;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
};

/** Small wrapper: renders a trigger button + its own ConfirmModal, so callsites stay one-liners. */
export function DestructiveConfirmButton({
  label,
  confirmTitle,
  confirmDescription,
  requireTypedText,
  confirmLabel,
  className,
  disabled,
  onConfirm,
}: DestructiveConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className ?? "btn btn-danger-ghost text-xs"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <ConfirmModal
        open={open}
        title={confirmTitle}
        description={confirmDescription}
        requireTypedText={requireTypedText}
        confirmLabel={confirmLabel ?? "Yes, delete"}
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
