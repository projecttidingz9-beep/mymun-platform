"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "register";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { login } = useAuth();
  const [tab, setTab] = useState<"signin" | "register">(defaultTab);
  const [registerRole, setRegisterRole] = useState<"delegate" | "organizer">("delegate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const closeModal = () => {
    setTab(defaultTab);
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setLoading(false);
    onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) { setError("Please fill all required fields."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (tab === "register" && !name) { setError("Please enter your full name."); return; }
    if (!email.includes("@")) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    const endpoint = tab === "register" ? "/api/auth/register" : "/api/auth/login";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email,
        password,
        ...(tab === "register" ? { name, role: registerRole } : {}),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      name?: string;
      role?: "delegate" | "organizer" | "admin";
    };
    if (!response.ok) {
      setError(payload.error || "Authentication failed.");
      setLoading(false);
      return;
    }
    login(email, payload.name || (tab === "register" ? name : undefined), payload.role || "delegate");
    closeModal();
  };

  const handleForgotPassword = async () => {
    setError("");
    if (!email || !email.includes("@")) {
      setError("Enter your account email first.");
      return;
    }
    setForgotLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Could not start password reset.");
        return;
      }
      setError("Password reset link sent. Please check your email.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) closeModal(); }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.58)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden animate-soft-scale"
        style={{
          background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 86%, #0f1218 14%), var(--bg))",
          border: "1.5px solid color-mix(in srgb, var(--border) 70%, #d3b07f 30%)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.32)",
        }}
      >
        {/* Header */}
        <div
          className="p-8 pb-6"
          style={{
            background: "linear-gradient(130deg, #151922 0%, #242d3b 65%, #2f3747 100%)",
            borderBottom: "1px solid rgba(244, 226, 198, 0.2)",
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <Image
                src="/tidingz-logo.png"
                alt="Tidingz logo"
                width={32}
                height={32}
                className="w-8 h-8 rounded-xl object-cover border border-[#f4e2c6]/30"
              />
              <span className="text-[#f8f4ec] font-bold tracking-wide uppercase text-sm">Tidingz</span>
            </div>
            <button
              onClick={closeModal}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all hover:scale-105"
            >
              ✕
            </button>
          </div>
          <h2 className="text-2xl font-bold text-[#f8f4ec] uppercase" style={{ letterSpacing: "0.03em" }}>
            {tab === "signin" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-[#f8f4ec]/72 text-sm mt-1">
            {tab === "signin"
              ? "Sign in to your delegate account"
              : "Create your account and start your MUN journey"}
          </p>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-6">
          <div className="tab-bar mb-6">
            <button
              className={`tab flex-1 ${tab === "signin" ? "active" : ""}`}
              onClick={() => { setTab("signin"); setError(""); }}
            >
              Sign In
            </button>
            <button
              className={`tab flex-1 ${tab === "register" ? "active" : ""}`}
              onClick={() => { setTab("register"); setError(""); }}
            >
              Register
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
          {tab === "register" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                  Register As
                </label>
                <select
                  value={registerRole}
                  onChange={(event) =>
                    setRegisterRole(event.target.value === "organizer" ? "organizer" : "delegate")
                  }
                  className="input-base"
                >
                  <option value="delegate">Participant</option>
                  <option value="organizer">Organizer</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
            />
            {tab === "signin" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs mt-2"
                style={{ color: "var(--blue)" }}
                disabled={forgotLoading}
              >
                {forgotLoading ? "Sending reset link..." : "Forgot password?"}
              </button>
            )}
          </div>

          {error && (
            <div
              className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
              style={{ background: "rgba(157, 46, 46, 0.12)", color: "#c84f4f", border: "1px solid rgba(157, 46, 46, 0.28)" }}
            >
              <span>!</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="lux-button-primary w-full mt-2 text-base hover:-translate-y-0.5"
            style={{ padding: "14px", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" style={{ animation: "spin 0.8s linear infinite" }} />
                {tab === "signin" ? "Signing in..." : "Creating account..."}
              </span>
            ) : (
              tab === "signin" ? "Sign In" : "Create Account"
            )}
          </button>

          <p className="text-center text-sm" style={{ color: "var(--fg-muted)" }}>
            {tab === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setTab(tab === "signin" ? "register" : "signin")}
              className="font-semibold"
              style={{ color: "var(--blue)" }}
            >
              {tab === "signin" ? "Register" : "Sign In"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
