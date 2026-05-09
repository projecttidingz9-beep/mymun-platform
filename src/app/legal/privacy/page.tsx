import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Tidingz",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
          Tidingz processes account data, registration details, and operational logs to run conferences. Use Supabase
          (PostgreSQL) and email providers under data-processing agreements appropriate to your deployment. Update this
          page with your legal counsel before production launch.
        </p>
      </main>
      <Footer />
    </>
  );
}
