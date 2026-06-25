import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CONFERENCES_PATH } from "@/lib/paths";

export const metadata: Metadata = {
  title: "About — Tidingz",
  description: "Why we built Tidingz for Model UN delegates and organizers.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell">
        <div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
          <div className="space-y-4">
            <p className="section-label">About</p>
            <h1 className="app-title text-3xl">Built for serious MUN seasons</h1>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Tidingz is a Model United Nations platform that connects delegates and organizers with registration,
              delegate passes, QR check-in, and conference operations — without spreadsheets scattered across chat apps.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Our mission</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              We believe conference teams should spend time on diplomacy and logistics, not copy-pasting applicant data.
              Tidingz gives organizers a single dashboard for applications, committees, payments tracking, and on-site
              check-in — while delegates get a clear path from discovery to pass in hand.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">What we ship today</h2>
            <ul className="list-disc pl-5 text-sm space-y-2" style={{ color: "var(--fg-muted)" }}>
              <li>Public catalog of published conferences</li>
              <li>Multi-step delegate registration and secure online payments via Cashfree</li>
              <li>Organizer dashboards with committee builder, applications, and team tools</li>
              <li>QR delegate passes and camera-based check-in</li>
              <li>Super-admin review queue for conference moderation</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Who we serve</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              High school and university MUN societies, independent secretariats, and regional conference circuits. Whether
              you run your first 80-delegate conference or your tenth international summit, Tidingz scales with your season.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Questions, partnerships, or support:{" "}
              <a href="mailto:support@tidingz.com" className="underline">
                support@tidingz.com
              </a>{" "}
              or our{" "}
              <Link href="/contact" className="underline">
                contact form
              </Link>
              .
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link href={CONFERENCES_PATH} className="btn btn-primary inline-flex">
              Browse conferences
            </Link>
            <Link href="/organizers" className="btn inline-flex" style={{ border: "1.5px solid var(--border)" }}>
              For organizers
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
