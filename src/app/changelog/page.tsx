import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Changelog — Tidingz",
};

const ENTRIES = [
  {
    date: "2026-06-02",
    title: "Public launch readiness",
    items: [
      "Production legal pages, cookie consent with reject option, and email verification for password sign-ups",
      "Brand assets, favicon, and middleware API boundary wired",
      "Newsletter acknowledgment emails; contact form fails safely when email is not configured",
      "Removed unshipped AI marketing copy; homepage shows live marketplace conferences when available",
    ],
  },
  {
    date: "2026-05-10",
    title: "Security and database hardening",
    items: [
      "Supabase RLS on app tables, session version revocation, account lockout",
      "Postgres-backed rate limits on auth and public forms",
    ],
  },
  {
    date: "2026-05-09",
    title: "Initial production platform",
    items: [
      "Marketplace, delegate checkout, organizer dashboard, manual payments, QR passes, admin review queue",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell max-w-3xl mx-auto px-4 py-16 space-y-8">
        <h1 className="text-2xl font-bold">Changelog</h1>
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Notable releases and improvements to Tidingz.
        </p>
        <ul className="space-y-8">
          {ENTRIES.map((entry) => (
            <li key={entry.date}>
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                {entry.date} — {entry.title}
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-sm" style={{ color: "var(--fg-muted)" }}>
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
