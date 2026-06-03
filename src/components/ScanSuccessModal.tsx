"use client";

import { useEffect } from "react";

export type ScanSuccessDetails = {
  delegateName: string;
  checkedInAt: string;
};

type ScanSuccessModalProps = {
  open: boolean;
  details: ScanSuccessDetails | null;
  onClose: () => void;
};

export default function ScanSuccessModal({ open, details, onClose }: ScanSuccessModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !details) return null;

  const checkedInLabel = new Date(details.checkedInAt).toLocaleString();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-success-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl">
        <div className="alert alert-success mb-4">
          <p id="scan-success-title" className="text-base font-semibold text-[var(--fg)]">
            Pass has been scanned successfully
          </p>
        </div>
        <p className="text-sm font-semibold text-[var(--fg)]">{details.delegateName}</p>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">Checked in at {checkedInLabel}</p>
        <button
          type="button"
          className="btn btn-primary w-full min-h-[44px] touch-manipulation mt-6"
          onClick={onClose}
        >
          Scan next
        </button>
      </div>
    </div>
  );
}
