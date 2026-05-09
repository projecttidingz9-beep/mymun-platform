import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About — Tidingz",
  description: "Why we built Tidingz for Model UN delegates and organizers.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell">
        <div className="max-w-3xl mx-auto px-4 py-16 space-y-6">
          <p className="section-label">About</p>
          <h1 className="app-title text-3xl">Built for serious MUN seasons</h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            Tidingz connects delegates and organizers with registration, passes, QR check-in, and organizer tooling —
            without spreadsheets scattered across chat apps.
          </p>
          <Link href="/marketplace" className="btn btn-primary inline-flex">
            Browse conferences
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
