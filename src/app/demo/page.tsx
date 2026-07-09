"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { loginHydrateErrorMessage, useAuth } from "@/lib/auth-context";
import { DEMO_ACCOUNTS } from "@/lib/demo-account";

type DemoRole = keyof typeof DEMO_ACCOUNTS;

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-[var(--fg-muted)]">{label}</p>
        <p className="text-sm font-medium text-[var(--fg)] break-all">{value}</p>
      </div>
      <button
        type="button"
        className="btn btn-ghost text-xs shrink-0 min-h-[36px]"
        onClick={() => void copyValue()}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function DemoCard({ role }: { role: DemoRole }) {
  const router = useRouter();
  const { login } = useAuth();
  const account = DEMO_ACCOUNTS[role];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: account.email,
          password: account.password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        name?: string;
        role?: "delegate" | "organizer" | "admin";
        user?: unknown;
      };
      if (!response.ok) {
        setError(payload.error || "Could not sign in to the demo account.");
        return;
      }
      const signedIn = await login(
        account.email,
        payload.name,
        payload.role || (role === "organizer" ? "organizer" : "delegate"),
        payload.user
      );
      if (!signedIn.ok) {
        setError(loginHydrateErrorMessage(signedIn.failure));
        return;
      }
      router.push(account.redirect);
    } catch {
      setError("Could not reach authentication server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">Demo account</p>
        <h2 className="text-xl font-semibold text-[var(--fg)] mt-1">{account.label}</h2>
        <p className="text-sm text-[var(--fg-muted)] mt-2">
          {role === "organizer"
            ? "Explore a pre-loaded conference with committees, applicants, pricing, and finance stats."
            : "See delegate registrations, profile, certificates, and conference history."}
        </p>
      </div>

      <div className="space-y-2">
        <CredentialRow label="Email" value={account.email} />
        <CredentialRow label="Password" value={account.password} />
      </div>

      <button
        type="button"
        className="btn btn-primary w-full min-h-[44px] touch-manipulation"
        disabled={loading}
        onClick={() => void handleLogin()}
      >
        {loading ? "Signing in…" : `Log in as ${account.label}`}
      </button>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main className="app-shell">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--fg-muted)]">Platform demo</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--fg)]">
              Explore Tidingz with a pre-loaded demo account
            </h1>
            <p className="text-sm sm:text-base text-[var(--fg-muted)] max-w-3xl">
              Share these credentials with organizers who want to see the platform before signing up.
              The demo conference includes committees, registrations, pricing phases, and dashboard
              workflows.
            </p>
          </header>

          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{
              background: "rgba(245,158,11,0.12)",
              borderColor: "rgba(245,158,11,0.28)",
              color: "var(--fg)",
            }}
          >
            Demo accounts are read-only. You can explore everything, but changes will not be saved.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DemoCard role="organizer" />
            <DemoCard role="delegate" />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 space-y-2">
            <h2 className="text-base font-semibold text-[var(--fg)]">What you can explore</h2>
            <ul className="text-sm text-[var(--fg-muted)] space-y-1 list-disc pl-5">
              <li>Organizer dashboard: committees, categories, applicants, allotments, communications</li>
              <li>Delegate dashboard: registrations, profile, certificates, awards, payments</li>
              <li>Public conference page: Tidingz MUN 2026 on the marketplace</li>
            </ul>
            <p className="text-sm text-[var(--fg-muted)] pt-2">
              Need a real account instead?{" "}
              <Link href="/" className="text-[var(--blue)] hover:underline">
                Create one on the homepage
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
