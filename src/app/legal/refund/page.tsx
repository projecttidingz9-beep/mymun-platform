import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Refund Policy — Tidingz",
};

export default function RefundPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4">Refund Policy</h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
          Refunds for offline / manual payments are handled per conference rules set by organizers. Document your
          conference-specific refund windows here.
        </p>
      </main>
      <Footer />
    </>
  );
}
