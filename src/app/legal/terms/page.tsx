import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms & Conditions — Tidingz",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4">Terms & Conditions</h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
          Platform terms govern use of Tidingz by delegates and organizers. Replace this stub with counsel-reviewed terms
          prior to accepting production traffic.
        </p>
      </main>
      <Footer />
    </>
  );
}
