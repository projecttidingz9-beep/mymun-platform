"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import { ensureServerSession } from "@/lib/client/session";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

type PaymentIntentRow = {
  id: string;
  status: string;
  amount: number;
  currency?: string | null;
  createdAt: string;
  registration?: {
    user?: { email?: string | null; name?: string | null };
  };
  confirmedBy?: { email?: string | null; name?: string | null } | null;
};

export default function OrganizerPaymentsPage() {
  const { user, authReady, organizerConferences } = useAuth();
  const toast = useToast();
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PaymentIntentRow[]>([]);

  useEffect(() => {
    void ensureServerSession();
  }, []);

  useEffect(() => {
    if (organizerConferences.length && !eventId) {
      setEventId(organizerConferences[0].id);
    }
  }, [organizerConferences, eventId]);

  const canUse = user?.role === "organizer" || user?.role === "admin";

  const load = async () => {
    if (!eventId || !canUse) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizers/payment-intents/${eventId}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { paymentIntents?: PaymentIntentRow[]; error?: string };
      if (!res.ok) {
        toast.show(data.error || "Could not load payments", "error");
        setRows([]);
        return;
      }
      setRows(data.paymentIntents ?? []);
    } catch {
      toast.show("Network error loading payments", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authReady && canUse && eventId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when selection changes
  }, [authReady, eventId, canUse]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [rows]
  );

  if (!authReady) {
    return <AppRouteSkeleton />;
  }

  if (!canUse) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-center" style={{ color: "var(--fg-muted)" }}>
            Organizer access required.{" "}
            <Link href="/organizers" className="underline" style={{ color: "var(--blue)" }}>
              Back to organizers
            </Link>
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-24">
        <div className="section-label mb-2">Finance</div>
        <h1 className="text-3xl font-semibold tracking-tight">Manual payment intents</h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--fg-muted)" }}>
          Track manual / offline payment requests raised during checkout. Confirm payouts in your banking app,
          then mark registrations paid from the Transactions section in your organizer dashboard.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
          <label className="text-sm font-medium" htmlFor="event-select">
            Conference
          </label>
          <select
            id="event-select"
            className="input-base text-sm max-w-md"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">Select conference</option>
            {organizerConferences.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-outline-blue text-sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <Link href="/organizers/dashboard" className="btn btn-ghost text-sm">
            ← Dashboard
          </Link>
        </div>

        <div
          className="mt-10 rounded-2xl overflow-x-auto"
          style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)" }}
        >
          <table className="min-w-[600px] w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Delegate</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Confirmed by</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center" style={{ color: "var(--fg-muted)" }}>
                    {loading ? "Loading…" : "No payment intents for this conference yet."}
                  </td>
                </tr>
              )}
              {sorted.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.registration?.user?.name || "—"}</div>
                    <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
                      {row.registration?.user?.email || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(row.currency || "INR")}{" "}
                    {Number(row.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-blue">{row.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--fg-muted)" }}>
                    {row.confirmedBy?.name || row.confirmedBy?.email || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}
