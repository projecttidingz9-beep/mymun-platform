import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Changelog — Tidingz",
};

export default function ChangelogPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell max-w-3xl mx-auto px-4 py-16 space-y-6">
        <h1 className="text-2xl font-bold">Changelog</h1>
        <ul className="space-y-4 text-sm" style={{ color: "var(--fg-muted)" }}>
          <li>
            <strong className="text-[var(--fg)]">2026-05-09</strong> — Production readiness pass: Supabase Postgres schema,
            manual payments flow, rate limits, organizer email safeguards.
          </li>
        </ul>
      </main>
      <Footer />
    </>
  );
}
