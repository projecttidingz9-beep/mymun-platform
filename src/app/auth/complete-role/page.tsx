"use client";

import Link from "next/link";
import { useState } from "react";
import BrandLogo from "@/components/BrandLogo";

/**
 * Shown when a user completes Supabase OAuth but has no Tidingz row yet and did not pre-select a role (e.g. Sign In tab).
 */
export default function CompleteOAuthRolePage() {
  const [role, setRole] = useState<"delegate" | "organizer">("delegate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/oauth-apply-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not finish sign-up.");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="w-full max-w-md space-y-6 rounded-3xl border p-8" style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
        <div className="flex justify-center">
          <BrandLogo variant="vertical" className="h-auto w-44 max-w-full object-contain" priority />
        </div>
        <h1 className="text-xl font-bold text-center">Choose account type</h1>
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          You signed in with Google for the first time. Pick how you&apos;ll use Tidingz.
        </p>
        <div>
          <label className="block text-sm font-semibold mb-2">Account type</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value === "organizer" ? "organizer" : "delegate")}
            className="input-base w-full"
          >
            <option value="delegate">Participant</option>
            <option value="organizer">Organizer</option>
          </select>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary w-full" disabled={loading} onClick={() => void submit()}>
          {loading ? "Saving…" : "Continue"}
        </button>
        <p className="text-center text-sm">
          <Link href="/" className="font-semibold" style={{ color: "var(--blue)" }}>
            Cancel and go home
          </Link>
        </p>
      </div>
    </div>
  );
}
