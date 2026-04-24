"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!token) {
      alert("Invalid reset link.");
      return;
    }
    if (!password || !confirmPassword) {
      alert("Please fill both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        alert(payload.error || "Could not reset password.");
        return;
      }
      alert("Password reset successful. Please sign in.");
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto card p-7 rounded-2xl animate-soft-scale" style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent 12%)" }}>
      <p className="lux-eyebrow mb-3">Account Recovery</p>
      <h1 className="text-xl font-bold mb-2 uppercase" style={{ color: "var(--fg)", letterSpacing: "0.04em" }}>Reset Password</h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-muted)" }}>
        Set a new password for your account.
      </p>
      <div className="space-y-3">
        <input
          type="password"
          className="input-base"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
        />
        <input
          type="password"
          className="input-base"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm new password"
        />
        <button onClick={onSubmit} className="lux-button-primary w-full py-3.5" disabled={loading}>
          {loading ? "Updating..." : "Reset Password"}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <Navbar />
      <div className="app-shell relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 80% 20%, var(--overlay-warm) 0%, transparent 35%)" }} />
        <div className="relative flex items-center justify-center min-h-[70vh]">
          <Suspense
            fallback={
              <div className="app-card max-w-md w-full mx-auto space-y-3">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-9 w-full" />
                <div className="skeleton h-9 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
      <Footer />
    </>
  );
}
