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
    <div className="max-w-md mx-auto card p-6 rounded-2xl">
      <h1 className="text-xl font-bold mb-2" style={{ color: "var(--fg)" }}>Reset Password</h1>
      <p className="text-sm mb-4" style={{ color: "var(--fg-muted)" }}>
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
        <button onClick={onSubmit} className="btn btn-primary w-full" disabled={loading}>
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
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: "var(--bg-subtle)" }}>
        <Suspense fallback={<div className="max-w-md mx-auto card p-6 rounded-2xl">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <Footer />
    </>
  );
}
