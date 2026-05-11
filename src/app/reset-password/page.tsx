"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/** Mirrors server `validateNewPassword` in `@/lib/server/password`. */
function describeNewPasswordError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenCheckLoading, setTokenCheckLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenMessage, setTokenMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setTokenCheckLoading(false);
      setTokenValid(false);
      setTokenMessage("Reset token is missing from this link.");
      return;
    }
    let active = true;
    const run = async () => {
      setTokenCheckLoading(true);
      try {
        const response = await fetch(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`);
        const payload = (await response.json().catch(() => ({}))) as { valid?: boolean; error?: string };
        if (!active) return;
        const valid = Boolean(payload.valid);
        setTokenValid(valid);
        setTokenMessage(valid ? "Reset link verified. You can set a new password now." : payload.error || "This reset link is invalid or expired.");
      } catch {
        if (!active) return;
        setTokenValid(false);
        setTokenMessage("Could not verify reset token. Please request a new reset link.");
      } finally {
        if (active) setTokenCheckLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [token]);

  const onSubmit = async () => {
    setFormError("");
    setSuccessMessage("");
    if (!token || !tokenValid) {
      setFormError("Invalid reset link.");
      return;
    }
    if (!password || !confirmPassword) {
      setFormError("Please fill both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    const policyErr = describeNewPasswordError(password);
    if (policyErr) {
      setFormError(policyErr);
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
        setFormError(payload.error || "Could not reset password.");
        return;
      }
      setSuccessMessage("Password reset successful. Redirecting you to sign in…");
      setTimeout(() => router.push("/"), 1200);
    } finally {
      setLoading(false);
    }
  };

  const passwordPolicyError = password ? describeNewPasswordError(password) : null;
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    tokenValid &&
    !tokenCheckLoading &&
    !loading &&
    Boolean(password) &&
    Boolean(confirmPassword) &&
    passwordsMatch &&
    !passwordPolicyError;

  return (
    <div className="max-w-md mx-auto card p-7 rounded-2xl animate-soft-scale" style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent 12%)" }}>
      <p className="lux-eyebrow mb-3">Account Recovery</p>
      <h1 className="text-xl font-bold mb-2 uppercase" style={{ color: "var(--fg)", letterSpacing: "0.04em" }}>Reset Password</h1>
      <p className="text-sm mb-2" style={{ color: "var(--fg-muted)" }}>
        Set a new password for your account.
      </p>
      <p className="text-[11px] mb-5 leading-relaxed" style={{ color: "var(--fg-muted)" }}>
        Use at least 8 characters with at least one letter and one number (same rules as sign up).
      </p>
      <div
        className="rounded-xl px-4 py-3 text-xs mb-4"
        style={
          tokenCheckLoading
            ? { background: "var(--bg-subtle)", color: "var(--fg-muted)", border: "1px solid var(--border)" }
            : tokenValid
              ? { background: "rgba(22,163,74,0.12)", color: "#15803d", border: "1px solid rgba(22,163,74,0.24)" }
              : { background: "rgba(220,38,38,0.12)", color: "#b91c1c", border: "1px solid rgba(220,38,38,0.24)" }
        }
      >
        {tokenCheckLoading ? "Verifying reset link..." : tokenMessage}
      </div>
      {(formError || successMessage) && (
        <div
          className="rounded-xl px-4 py-3 text-xs mb-4"
          style={{
            background: successMessage ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)",
            color: successMessage ? "#15803d" : "#b91c1c",
            border: successMessage ? "1px solid rgba(22,163,74,0.24)" : "1px solid rgba(220,38,38,0.24)",
          }}
          role="status"
        >
          {successMessage || formError}
        </div>
      )}
      <div className="space-y-3">
        <input
          type="password"
          className="input-base"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          autoComplete="new-password"
        />
        {passwordPolicyError && (
          <p className="text-[11px]" style={{ color: "#b45309" }}>
            {passwordPolicyError}
          </p>
        )}
        <input
          type="password"
          className="input-base"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-[11px]" style={{ color: "#b45309" }}>
            Passwords do not match.
          </p>
        )}
        <button
          type="button"
          onClick={onSubmit}
          className="lux-button-primary w-full py-3.5"
          disabled={!canSubmit}
          style={{ opacity: canSubmit ? 1 : 0.55 }}
        >
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
