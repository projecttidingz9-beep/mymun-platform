"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import { useAuth } from "@/lib/auth-context";

type DelegationInfo = {
  delegation: {
    id: string;
    schoolName: string;
    maxMembers: number | null;
    status: string;
    memberCount: number;
  };
  event: {
    id: string;
    title: string;
    startDate: string;
  };
};

export default function JoinDelegationPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);
  const { isLoggedIn, authReady, user } = useAuth();
  const [info, setInfo] = useState<DelegationInfo | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/delegations/join/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setInfo(data as DelegationInfo);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load delegation invite.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleJoin = async () => {
    if (!isLoggedIn) {
      router.push(`/?redirect=${encodeURIComponent(`/join/delegation/${token}`)}`);
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/delegations/join/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error || "Failed to join delegation.");
        return;
      }
      setJoined(true);
      if (info?.event.id) {
        router.push(`/checkout/${info.event.id}`);
      }
    } finally {
      setJoining(false);
    }
  };

  if (!authReady || (!info && !error)) {
    return <AppRouteSkeleton />;
  }

  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-lg mx-auto">
          <div className="app-card p-8 space-y-4">
            {error ? (
              <>
                <h1 className="app-title">Invalid invite</h1>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{error}</p>
                <Link href="/marketplace" className="btn btn-primary">
                  Browse conferences
                </Link>
              </>
            ) : info ? (
              <>
                <h1 className="app-title">Join delegation</h1>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  You&apos;ve been invited to join <strong>{info.delegation.schoolName}</strong> at{" "}
                  <strong>{info.event.title}</strong>.
                </p>
                <div className="rounded-xl p-4 space-y-1" style={{ background: "var(--bg-subtle)" }}>
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    Members: {info.delegation.memberCount}
                    {info.delegation.maxMembers ? ` / ${info.delegation.maxMembers}` : ""}
                  </p>
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    Event date: {info.event.startDate}
                  </p>
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    Status: {info.delegation.status}
                  </p>
                </div>
                {!isLoggedIn ? (
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                    Sign in or create an account to join this delegation.
                  </p>
                ) : joined ? (
                  <p className="text-sm" style={{ color: "#16a34a" }}>
                    Joined! Redirecting to registration…
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={joining || info.delegation.status === "CLOSED" || joined}
                  onClick={() => void handleJoin()}
                >
                  {joining ? "Joining…" : isLoggedIn ? "Join delegation & register" : "Sign in to join"}
                </button>
                {user?.role === "organizer" && (
                  <p className="text-xs" style={{ color: "var(--warning)" }}>
                    Organizer accounts cannot join as delegates.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
