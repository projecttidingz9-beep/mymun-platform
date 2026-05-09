import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Cookie Policy — Tidingz",
};

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4">Cookie Policy</h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
          Tidingz uses essential cookies for authentication (`mymun_session`) and optional analytics when enabled.
          Describe third-party cookies after wiring observability tools.
        </p>
      </main>
      <Footer />
    </>
  );
}
