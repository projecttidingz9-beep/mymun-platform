"use client";

import { useEffect, useState } from "react";
import { isConferenceScheduleEntryComplete } from "@/lib/conference-schedule";

export type ScheduleFirstEventDraft = {
  fromTime: string;
  toTime: string;
  title: string;
};

type ScheduleAddDayModalProps = {
  open: boolean;
  defaultDayName: string;
  onClose: () => void;
  onConfirm: (dayName: string, firstEvent?: ScheduleFirstEventDraft) => void;
};

export default function ScheduleAddDayModal({
  open,
  defaultDayName,
  onClose,
  onConfirm,
}: ScheduleAddDayModalProps) {
  const [dayName, setDayName] = useState(defaultDayName);
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDayName(defaultDayName);
    setFromTime("");
    setToTime("");
    setTitle("");
    setError("");
  }, [open, defaultDayName]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmedDay = dayName.trim();
    if (!trimmedDay) {
      setError("Enter a day name.");
      return;
    }
    const eventDraft = { fromTime: fromTime.trim(), toTime: toTime.trim(), title: title.trim() };
    const hasAnyEventField = eventDraft.fromTime || eventDraft.toTime || eventDraft.title;
    if (hasAnyEventField) {
      const complete = isConferenceScheduleEntryComplete({ day: trimmedDay, ...eventDraft });
      if (!complete) {
        setError("Fill in from time, to time, and event title, or leave all event fields empty.");
        return;
      }
      onConfirm(trimmedDay, eventDraft);
      return;
    }
    onConfirm(trimmedDay);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-add-day-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl">
        <h2 id="schedule-add-day-title" className="text-lg font-semibold text-[var(--fg)]">
          Add schedule day
        </h2>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Name the day and optionally add your first timed event.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: "var(--fg-muted)" }}>
              Day name
            </label>
            <input
              className="input-base text-sm w-full"
              value={dayName}
              onChange={(event) => {
                setDayName(event.target.value);
                setError("");
              }}
              placeholder="Day 1"
              autoFocus
            />
          </div>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)" }}
          >
            <p className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
              First event (optional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "var(--fg-muted)" }}>
                  From
                </label>
                <input
                  className="input-base text-sm w-full"
                  value={fromTime}
                  onChange={(event) => {
                    setFromTime(event.target.value);
                    setError("");
                  }}
                  placeholder="09:00"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "var(--fg-muted)" }}>
                  To
                </label>
                <input
                  className="input-base text-sm w-full"
                  value={toTime}
                  onChange={(event) => {
                    setToTime(event.target.value);
                    setError("");
                  }}
                  placeholder="10:30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: "var(--fg-muted)" }}>
                Event
              </label>
              <input
                className="input-base text-sm w-full"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
                placeholder="Opening ceremony"
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button type="button" className="btn btn-ghost min-h-[44px] touch-manipulation" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary min-h-[44px] touch-manipulation" onClick={handleConfirm}>
            Add day
          </button>
        </div>
      </div>
    </div>
  );
}
