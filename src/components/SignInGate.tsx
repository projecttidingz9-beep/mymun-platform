"use client";

import Link from "next/link";

interface SignInGateProps {
  title: string;
  description: string;
  onSignIn: () => void;
  backHref?: string;
  backLabel?: string;
}

export default function SignInGate({
  title,
  description,
  onSignIn,
  backHref = "/",
  backLabel = "Back to home",
}: SignInGateProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div
        className="card p-8 rounded-2xl max-w-md w-full space-y-5 text-center"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="mx-auto w-12 h-12 rounded-full flex items-center justify-center text-lg"
          style={{
            background: "color-mix(in srgb, var(--accent-warm) 16%, var(--bg-subtle) 84%)",
            color: "var(--fg)",
          }}
          aria-hidden
        >
          🔐
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
            {title}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            {description}
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button type="button" className="btn btn-primary w-full" onClick={onSignIn}>
            Sign in
          </button>
          <Link href={backHref} className="btn btn-ghost w-full">
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
