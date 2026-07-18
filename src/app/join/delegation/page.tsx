"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { normalizeDelegationCode } from "@/lib/delegation-code";

export default function JoinDelegationByCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const normalizedCode = normalizeDelegationCode(code);

  return (
    <>
      <Navbar />
      <main className="app-shell">
        <div className="max-w-lg mx-auto">
          <div className="app-card p-8 space-y-5">
            <div>
              <div className="section-label mb-3">Delegation registration</div>
              <h1 className="app-title">Join with a team code</h1>
              <p className="app-subtitle mt-2">
                Enter the unique code shared by your delegation head. You will then complete your own
                committee preferences and payment.
              </p>
            </div>
            <input
              className="input-base text-lg font-mono uppercase tracking-[0.2em]"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="TEAM CODE"
              autoComplete="off"
              aria-label="Delegation team code"
            />
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={!normalizedCode}
              onClick={() => router.push(`/join/delegation/${encodeURIComponent(normalizedCode)}`)}
            >
              Continue
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
