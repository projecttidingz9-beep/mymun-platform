"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import BrandLogo from "@/components/BrandLogo";
import { createSupabaseBrowserClient, isSupabaseOAuthConfigured } from "@/lib/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "register";
}

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleApi = {
  accounts?: {
    id?: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          theme: "outline";
          size: "large";
          shape: "pill";
          text: "signin_with" | "signup_with";
          width: number;
        }
      ) => void;
    };
  };
};

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
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [forgotDevUrl, setForgotDevUrl] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleRole, setGoogleRole] = useState<"delegate" | "organizer">("delegate");
  const [googlePendingCredential, setGooglePendingCredential] = useState("");
  const [showGoogleRoleStep, setShowGoogleRoleStep] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const supabaseOAuthEnabled = isSupabaseOAuthConfigured();
  const legacyGoogleEnabled = googleClientId.trim().length > 0 && !supabaseOAuthEnabled;
  const oauthEnabled = supabaseOAuthEnabled || legacyGoogleEnabled;

  const closeModal = useCallback(() => {
    setTab(defaultTab);
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setLoading(false);
    setShowPassword(false);
    setForgotMode(false);
    setForgotEmail("");
    setForgotNotice("");
    setForgotDevUrl("");
    setGoogleLoading(false);
    setGoogleRole("delegate");
    setGooglePendingCredential("");
    setShowGoogleRoleStep(false);
    onClose();
  }, [defaultTab, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const completeGoogleSignIn = useCallback(async (credential: string, selectedRole?: "delegate" | "organizer") => {
    if (!credential) return;
    setError("");
    setGoogleLoading(true);
    const response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        idToken: credential,
        role: selectedRole,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      requiresRole?: boolean;
      email?: string;
      name?: string;
      role?: "delegate" | "organizer" | "admin";
    };
    if (payload.requiresRole) {
      setGooglePendingCredential(credential);
      setShowGoogleRoleStep(true);
      setGoogleLoading(false);
      return;
    }
    if (!response.ok || !payload.email) {
      setError(payload.error || "Google sign-in failed.");
      setGoogleLoading(false);
      return;
    }
    login(payload.email, payload.name || undefined, payload.role || "delegate");
    closeModal();
  }, [closeModal, login]);

  const startSupabaseGoogleOAuth = useCallback(async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await fetch("/api/auth/oauth-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(tab === "register" ? { role: registerRole } : {}),
      });
      const supabase = createSupabaseBrowserClient();
      const publicOrigin =
        process.env.NODE_ENV === "production"
          ? (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim() || window.location.origin)
          : window.location.origin;
      const redirectTo = `${publicOrigin}/auth/callback?next=${encodeURIComponent("/dashboard")}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }, [tab, registerRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) { setError("Please fill all required fields."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must include at least one letter and one number.");
      return;
    }
    if (tab === "register" && !name) { setError("Please enter your full name."); return; }
    if (!email.includes("@")) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    const endpoint = tab === "register" ? "/api/auth/register" : "/api/auth/login";
    try {
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
        return;
      }
      login(email, payload.name || (tab === "register" ? name : undefined), payload.role || "delegate");
      closeModal();
    } catch {
      setError("Could not reach authentication server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setForgotNotice("");
    setForgotDevUrl("");
    const targetEmail = forgotEmail.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Enter a valid account email.");
      return;
    }
    setForgotLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        devResetUrl?: string;
        code?: string;
      };
      if (!response.ok) {
        const apiMsg = payload.error ?? payload.message;
        setError(apiMsg || "Could not start password reset.");
        return;
      }
      if (typeof payload.devResetUrl === "string" && payload.devResetUrl.length > 0) {
        setForgotNotice(
          "Email is not configured in this environment. Use the one-time reset link below (development only)."
        );
        setForgotDevUrl(payload.devResetUrl);
        return;
      }
      setForgotNotice("Password reset link sent. Please check your email.");
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !legacyGoogleEnabled || forgotMode || showGoogleRoleStep) return;
    const renderGoogleButton = () => {
      const googleApi = (window as Window & { google?: GoogleApi }).google;
      if (!googleApi?.accounts?.id || !googleButtonRef.current) return;
      googleApi.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: GoogleCredentialResponse) => {
          const credential = response.credential || "";
          if (!credential) {
            setError("Google Sign-In did not return a credential.");
            return;
          }
          void completeGoogleSignIn(credential);
        },
      });
      googleButtonRef.current.innerHTML = "";
      googleApi.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: tab === "signin" ? "signin_with" : "signup_with",
        width: 320,
      });
    };

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => renderGoogleButton();
    script.onerror = () => setError("Unable to load Google Sign-In.");
    document.head.appendChild(script);
  }, [isOpen, legacyGoogleEnabled, forgotMode, showGoogleRoleStep, googleClientId, tab, completeGoogleSignIn]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) closeModal(); }}
      className="fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto overscroll-contain px-4 py-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      style={{ background: "rgba(0,0,0,0.58)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-md max-h-[min(92dvh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain rounded-3xl animate-soft-scale my-auto touch-manipulation"
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
              <BrandLogo
                variant="icon"
                themeOverride="dark"
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
              onClick={() => { setTab("signin"); setError(""); setForgotMode(false); setForgotNotice(""); setForgotDevUrl(""); }}
            >
              Sign In
            </button>
            <button
              className={`tab flex-1 ${tab === "register" ? "active" : ""}`}
              onClick={() => { setTab("register"); setError(""); setForgotMode(false); setForgotNotice(""); setForgotDevUrl(""); }}
            >
              Register
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
          {oauthEnabled && !forgotMode && (
            <div className="space-y-3">
              {supabaseOAuthEnabled ? (
                <>
                  <button
                    type="button"
                    className="lux-button-primary w-full text-base hover:-translate-y-0.5"
                    style={{ padding: "12px" }}
                    disabled={googleLoading}
                    onClick={() => void startSupabaseGoogleOAuth()}
                  >
                    {googleLoading ? "Redirecting…" : "Continue with Google"}
                  </button>
                  <p className="text-center text-xs" style={{ color: "var(--fg-muted)" }}>
                    or continue with email
                  </p>
                </>
              ) : !showGoogleRoleStep ? (
                <>
                  <div ref={googleButtonRef} className="w-full flex justify-center" />
                  <p className="text-center text-xs" style={{ color: "var(--fg-muted)" }}>
                    or continue with email
                  </p>
                </>
              ) : (
                <div className="space-y-3 rounded-2xl p-4" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                    Choose account type for Google sign-up
                  </p>
                  <select
                    value={googleRole}
                    onChange={(event) => setGoogleRole(event.target.value === "organizer" ? "organizer" : "delegate")}
                    className="input-base"
                  >
                    <option value="delegate">Participant</option>
                    <option value="organizer">Organizer</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary text-xs flex-1"
                      disabled={googleLoading}
                      onClick={() => void completeGoogleSignIn(googlePendingCredential, googleRole)}
                    >
                      {googleLoading ? "Finishing..." : "Continue with Google"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => {
                        setShowGoogleRoleStep(false);
                        setGooglePendingCredential("");
                      }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!oauthEnabled && !forgotMode && (
            <p className="text-xs text-center" style={{ color: "var(--fg-muted)" }}>
              Google Sign-In is not configured (add Supabase URL/key or Google client ID).
            </p>
          )}
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

          {!forgotMode ? (
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                  style={{ color: "var(--fg-muted)" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {tab === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotEmail(email);
                    setForgotNotice("");
                    setForgotDevUrl("");
                    setError("");
                  }}
                  className="text-xs mt-2"
                  style={{ color: "var(--blue)" }}
                >
                  Forgot password?
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl p-4" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                Password recovery
              </p>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                Enter your account email and we&apos;ll send a reset link.
              </p>
              <input
                type="email"
                placeholder="you@university.edu"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="input-base"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="btn btn-primary text-xs flex-1"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Sending reset link..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setForgotNotice("");
                    setForgotDevUrl("");
                    setError("");
                  }}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(error || forgotNotice) && (
            <div
              className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
              style={
                error
                  ? { background: "rgba(157, 46, 46, 0.12)", color: "#c84f4f", border: "1px solid rgba(157, 46, 46, 0.28)" }
                  : { background: "rgba(22,163,74,0.12)", color: "#15803d", border: "1px solid rgba(22,163,74,0.25)" }
              }
            >
              <span>{error ? "!" : "✓"}</span> {error || forgotNotice}
            </div>
          )}
          {forgotDevUrl && (
            <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <input readOnly className="input-base text-xs w-full" value={forgotDevUrl} aria-label="Development reset link" />
              <button
                type="button"
                className="btn btn-secondary text-xs w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(forgotDevUrl);
                }}
              >
                Copy link
              </button>
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
              onClick={() => {
                setTab(tab === "signin" ? "register" : "signin");
                setForgotMode(false);
                setForgotNotice("");
                setForgotDevUrl("");
                setError("");
              }}
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
