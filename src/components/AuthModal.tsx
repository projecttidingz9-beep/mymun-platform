"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "register";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { login } = useAuth();
  const [tab, setTab] = useState<"signin" | "register">(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setError("");
      setEmail("");
      setPassword("");
      setName("");
    }
  }, [isOpen, defaultTab]);

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
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (tab === "register" && !name) { setError("Please enter your full name."); return; }
    if (!email.includes("@")) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 900)); // Simulate API
    login(email, tab === "register" ? name : undefined);
    setLoading(false);
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden animate-fade-up"
        style={{
          background: "var(--bg)",
          border: "1.5px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          className="p-8 pb-6"
          style={{
            background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-sm italic">M</span>
              </div>
              <span className="text-white font-bold">Tidingz</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {tab === "signin" ? "Welcome back 👋" : "Join Tidingz 🌍"}
          </h2>
          <p className="text-white/70 text-sm mt-1">
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
          </div>

          {error && (
            <div
              className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
              style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}
            >
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full mt-2 text-base"
            style={{ padding: "14px", borderRadius: "12px", opacity: loading ? 0.7 : 1 }}
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
