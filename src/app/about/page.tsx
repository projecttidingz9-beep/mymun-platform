import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CONFERENCES_PATH } from "@/lib/paths";

export const metadata: Metadata = {
  title: "About — Tidingz",
  description: "Why we built Tidingz for Model UN delegates and organizers.",
};

const FEATURES = [
  {
    icon: "🌐",
    title: "Conference catalog",
    body: "Published MUN conferences with filters for level, region, dates, and budget.",
  },
  {
    icon: "💳",
    title: "Secure registration",
    body: "Multi-step checkout with Cashfree payments and instant confirmation.",
  },
  {
    icon: "📋",
    title: "Organizer dashboard",
    body: "Committee builder, applications, allotments, and team tools in one place.",
  },
  {
    icon: "📱",
    title: "QR delegate passes",
    body: "Digital passes delegates can show at the gate — no extra hardware.",
  },
  {
    icon: "✅",
    title: "On-site check-in",
    body: "Camera-based QR scanning from any browser at the venue.",
  },
  {
    icon: "🛡️",
    title: "Admin moderation",
    body: "Super-admin review queue before conferences go live on the marketplace.",
  },
];

export default function AboutPage() {
  return (
    <div className="lux-shell lux-shell-immersive min-h-screen">
      <div aria-hidden className="lux-backdrop" />
      <Navbar />
      <main className="relative lux-section pt-[calc(9rem+env(safe-area-inset-top,0px))] pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-14">
          <div className="space-y-5 max-w-3xl">
            <span className="lux-pill">
              <span className="lux-pill-dot" />
              About Tidingz
            </span>
            <h1 className="lux-display-xl" style={{ color: "var(--fg-immersive)" }}>
              Built for serious MUN seasons
            </h1>
            <p className="lux-subdisplay">
              Tidingz connects delegates and organizers with registration, delegate passes, QR check-in,
              and conference operations — without spreadsheets scattered across chat apps.
            </p>
          </div>

          <section className="lux-card p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--fg-immersive)" }}>
              Our mission
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(243,237,224,0.68)" }}>
              Conference teams should spend time on diplomacy and logistics, not copy-pasting applicant data.
              Tidingz gives organizers a single dashboard for applications, committees, payments, and on-site
              check-in — while delegates get a clear path from discovery to pass in hand.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-lg font-semibold" style={{ color: "var(--fg-immersive)" }}>
              What we ship today
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="lux-card p-5 h-full">
                  <span className="text-2xl" aria-hidden>
                    {feature.icon}
                  </span>
                  <h3 className="mt-3 font-semibold text-sm" style={{ color: "var(--fg-immersive)" }}>
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(243,237,224,0.65)" }}>
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="lux-card p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--fg-immersive)" }}>
              Who we serve
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(243,237,224,0.68)" }}>
              High school and university MUN societies, independent secretariats, and regional conference circuits.
              Whether you run your first 80-delegate conference or your tenth international summit, Tidingz scales
              with your season.
            </p>
          </section>

          <section className="lux-card p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--fg-immersive)" }}>
              Contact
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(243,237,224,0.68)" }}>
              Questions, partnerships, or support:{" "}
              <a href="mailto:support@tidingz.com" className="underline" style={{ color: "var(--fg-immersive)" }}>
                support@tidingz.com
              </a>{" "}
              or our{" "}
              <Link href="/contact" className="underline" style={{ color: "var(--fg-immersive)" }}>
                contact form
              </Link>
              .
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link href={CONFERENCES_PATH} className="lux-button-primary inline-flex px-6 py-3">
              Browse conferences
            </Link>
            <Link
              href="/organizers"
              className="lux-button-ghost inline-flex px-6 py-3"
              style={{ color: "var(--fg-immersive)", borderColor: "rgba(243,237,224,0.28)" }}
            >
              For organizers
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
