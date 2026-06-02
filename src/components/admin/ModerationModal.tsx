"use client";

type ModerationModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
};

export default function ModerationModal({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  busy,
  onClose,
  onConfirm,
  children,
}: ModerationModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl">
        <h2 id="moderation-modal-title" className="text-lg font-semibold text-[var(--fg)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            className="btn btn-ghost min-h-[44px] touch-manipulation"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn min-h-[44px] touch-manipulation ${
              confirmVariant === "danger" ? "btn-danger-ghost" : "btn-primary"
            }`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
