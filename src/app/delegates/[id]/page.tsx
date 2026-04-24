"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { MOCK_USER } from "@/lib/data";
import { DelegateMunAward, DelegateMunParticipation, User } from "@/lib/types";

export default function DelegateProfilePage() {
  const params = useParams();
  const { user } = useAuth();
  const delegateId = String(params.id || "");
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const profile = useMemo<User | null>(() => {
    if (hydrated && user?.id === delegateId) return user;
    if (MOCK_USER.id === delegateId) return MOCK_USER;

    if (hydrated && typeof window !== "undefined") {
      const stored = localStorage.getItem("tidingz_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as User;
          if (parsed?.id === delegateId) return parsed;
        } catch {
          // ignore malformed storage
        }
      }
    }
    return null;
  }, [delegateId, hydrated, user]);

  const profileVisibility = profile?.profileVisibility ?? "public";
  const isVisible = profileVisibility === "public";

  if (!profile) {
    return (
      <>
        <Navbar />
        <div className="app-shell">
          <div className="max-w-3xl mx-auto">
            <div className="app-card text-center py-16 space-y-4">
              <h1 className="app-title">Delegate Profile Not Found</h1>
              <p className="app-subtitle">
                This delegate profile is unavailable or may have been set to private.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Link href="/marketplace" className="btn btn-primary text-sm">
                  Browse Marketplace
                </Link>
                <Link href="/dashboard" className="btn btn-ghost text-sm">
                  ← Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="app-header">
            <div className="app-header-copy">
              <div className="section-label mb-3">Delegate Profile</div>
              <h1 className="app-title">{profile.name}</h1>
              <p className="app-subtitle mt-2">
                {profile.school} · {profile.country}
              </p>
            </div>
            <div className="app-header-actions">
              <span className={`badge ${isVisible ? "badge-success" : "badge-warning"}`}>
                {isVisible ? "Public Profile" : "Private Profile"}
              </span>
            </div>
          </header>

          <div className="app-card">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--blue), var(--accent-warm))" }}
              >
                {profile.avatar}
              </div>
              <div className="min-w-0">
                <p className="font-bold" style={{ color: "var(--fg)" }}>{profile.name}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {profile.profileHeadline || "MUN delegate"}
                </p>
              </div>
            </div>
          </div>

          {!isVisible ? (
            <div className="app-card">
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                This delegate has set their profile to private.
              </p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="app-card">
                  <div className="app-card-header">
                    <h2 className="app-card-title">MUN Experience Summary</h2>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                    {profile.munExperienceSummary || "No experience summary added yet."}
                  </p>
                </div>
                <div className="app-card">
                  <div className="app-card-header">
                    <h2 className="app-card-title">Awards Summary</h2>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                    {profile.munAwardsSummary || "No awards summary added yet."}
                  </p>
                </div>
              </div>

              <div className="app-card">
                <div className="app-card-header">
                  <h2 className="app-card-title">
                    Participation History ({profile.munParticipations?.length || 0})
                  </h2>
                </div>
                {(profile.munParticipations || []).length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No participations added.</p>
                ) : (
                  <div className="space-y-3">
                    {(profile.munParticipations || []).map((entry: DelegateMunParticipation) => (
                      <div key={entry.id} className="rounded-xl p-4" style={{ background: "var(--bg-subtle)" }}>
                        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                          {entry.conferenceName} {entry.year ? `(${entry.year})` : ""}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                          {entry.role || "Delegate"} {entry.committee ? `· ${entry.committee}` : ""}{" "}
                          {entry.countryRepresented ? `· ${entry.countryRepresented}` : ""}
                        </p>
                        {entry.notes && (
                          <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>{entry.notes}</p>
                        )}
                        {entry.certificateUrl && (
                          <a
                            href={entry.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost text-xs mt-2 inline-flex"
                          >
                            View Certificate
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="app-card">
                <div className="app-card-header">
                  <h2 className="app-card-title">
                    Awards ({profile.munAwards?.length || 0})
                  </h2>
                </div>
                {(profile.munAwards || []).length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No awards added.</p>
                ) : (
                  <div className="space-y-3">
                    {(profile.munAwards || []).map((entry: DelegateMunAward) => (
                      <div key={entry.id} className="rounded-xl p-4" style={{ background: "var(--bg-subtle)" }}>
                        <div className="flex items-center gap-3">
                          {entry.logoUrl && (
                            <Image
                              src={entry.logoUrl}
                              alt={`${entry.title} logo`}
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded object-cover"
                              style={{ border: "1px solid var(--border)" }}
                              unoptimized
                            />
                          )}
                          <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                            {entry.title} · {entry.conferenceName} {entry.year ? `(${entry.year})` : ""}
                          </p>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                          {entry.category || "General"} {entry.committee ? `· ${entry.committee}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Link href="/dashboard" className="btn btn-ghost text-sm">← Back to Dashboard</Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
