"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ensureServerSession } from "@/lib/client/session";
import { useAuth } from "@/lib/auth-context";
import { CONFERENCES } from "@/lib/data";
import { DelegateMunAward, DelegateMunParticipation } from "@/lib/types";

export default function DashboardPage() {
  const { user, isLoggedIn, notifications, markNotificationRead, updateDelegateProfile } = useAuth();
  const router = useRouter();
  const [delegatePasses, setDelegatePasses] = useState<Array<{
    id: string;
    eventName: string;
    committeeName?: string;
    portfolioName?: string;
    categoryName: string;
    registrationId: string;
    releaseAt: string;
    released: boolean;
    checkedIn: boolean;
    checkedInAt?: string | null;
    qrImageDataUrl?: string;
    qrToken: string;
  }>>([]);
  const [serverNotifications, setServerNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
  }>>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftSchool, setDraftSchool] = useState("");
  const [draftCountry, setDraftCountry] = useState("");
  const [draftExperienceSummary, setDraftExperienceSummary] = useState("");
  const [draftAwardsSummary, setDraftAwardsSummary] = useState("");
  const [draftParticipations, setDraftParticipations] = useState<DelegateMunParticipation[]>([]);
  const [draftAwards, setDraftAwards] = useState<DelegateMunAward[]>([]);

  useEffect(() => {
    if (!isLoggedIn) router.push("/");
  }, [isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    void ensureServerSession({ email: user.email, role: "delegate", name: user.name });
    void fetch("/api/passes/me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setDelegatePasses(data.passes || []))
      .catch(() => setDelegatePasses([]));
    void fetch("/api/notifications/me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setServerNotifications(data.notifications || []))
      .catch(() => setServerNotifications([]));
  }, [isLoggedIn, user]);

  if (!isLoggedIn || !user) return null;

  const registrations = user.registeredConferences;
  const myNotifications = notifications.filter(
    (notification) =>
      (!notification.userEmail || notification.userEmail === user.email) &&
      (!notification.userId || notification.userId === user.id)
  );
  const mergedNotifications = [
    ...serverNotifications,
    ...myNotifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      read: notification.read,
    })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const totalPaid = registrations.filter(r => r.paid).reduce((sum, r) => sum + r.amount, 0);
  const confirmed = registrations.filter(r => r.status === "Confirmed").length;

  const STATUS_STYLE: Record<string, { class: string }> = {
    Confirmed: { class: "badge-green" },
    Waitlisted: { class: "badge-gold" },
    Pending: { class: "badge-gray" },
  };

  const startEditingProfile = () => {
    setDraftSchool(user.school || "");
    setDraftCountry(user.country || "");
    setDraftExperienceSummary(user.munExperienceSummary || "");
    setDraftAwardsSummary(user.munAwardsSummary || "");
    setDraftParticipations(user.munParticipations || []);
    setDraftAwards(user.munAwards || []);
    setIsEditingProfile(true);
  };

  const addParticipation = () => {
    setDraftParticipations((prev) => [
      ...prev,
      {
        id: `part-${Date.now()}-${prev.length}`,
        conferenceName: "",
        committee: "",
        role: "",
        year: undefined,
        countryRepresented: "",
        notes: "",
      },
    ]);
  };

  const updateParticipation = (id: string, patch: Partial<DelegateMunParticipation>) => {
    setDraftParticipations((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const moveParticipation = (id: string, direction: "up" | "down") => {
    setDraftParticipations((prev) => {
      const currentIndex = prev.findIndex((entry) => entry.id === id);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const removeParticipation = (id: string) => {
    setDraftParticipations((prev) => prev.filter((entry) => entry.id !== id));
  };

  const addAward = () => {
    setDraftAwards((prev) => [
      ...prev,
      {
        id: `award-${Date.now()}-${prev.length}`,
        title: "",
        conferenceName: "",
        year: undefined,
        category: "",
        committee: "",
      },
    ]);
  };

  const updateAward = (id: string, patch: Partial<DelegateMunAward>) => {
    setDraftAwards((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const moveAward = (id: string, direction: "up" | "down") => {
    setDraftAwards((prev) => {
      const currentIndex = prev.findIndex((entry) => entry.id === id);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const removeAward = (id: string) => {
    setDraftAwards((prev) => prev.filter((entry) => entry.id !== id));
  };

  const saveProfile = () => {
    updateDelegateProfile({
      school: draftSchool.trim(),
      country: draftCountry.trim(),
      munExperienceSummary: draftExperienceSummary.trim(),
      munAwardsSummary: draftAwardsSummary.trim(),
      profileVisibility: "public",
      munParticipations: draftParticipations
        .filter((entry) => entry.conferenceName.trim())
        .map((entry) => ({
          ...entry,
          conferenceName: entry.conferenceName.trim(),
          committee: entry.committee?.trim() || undefined,
          role: entry.role?.trim() || undefined,
          countryRepresented: entry.countryRepresented?.trim() || undefined,
          notes: entry.notes?.trim() || undefined,
          year: entry.year,
        })),
      munAwards: draftAwards
        .filter((entry) => entry.title.trim() && entry.conferenceName.trim())
        .map((entry) => ({
          ...entry,
          title: entry.title.trim(),
          conferenceName: entry.conferenceName.trim(),
          category: entry.category?.trim() || undefined,
          committee: entry.committee?.trim() || undefined,
          year: entry.year,
        })),
    });
    setIsEditingProfile(false);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: "var(--bg-subtle)" }}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="section-label mb-3">My Dashboard</div>
              <h1 className="text-4xl font-black" style={{ color: "var(--fg)" }}>
                Welcome back, {user.name.split(" ")[0]} 👋
              </h1>
              <p className="text-base mt-1" style={{ color: "var(--fg-muted)" }}>
                {user.school} · {user.country}
              </p>
            </div>
            <Link href="/marketplace" className="btn btn-primary text-sm">
              + Find Conference
            </Link>
          </div>

          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Conferences", value: registrations.length, icon: "🌍", color: "#2563eb" },
              { label: "Confirmed", value: confirmed, icon: "✅", color: "#16a34a" },
              { label: "Countries Represented", value: [...new Set(registrations.map(r => r.country))].length, icon: "🏳️", color: "#7c3aed" },
              { label: "Total Invested", value: `$${totalPaid}`, icon: "💳", color: "#d97706" },
            ].map((stat) => (
              <div key={stat.label} className="card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{stat.icon}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: stat.color }} />
                </div>
                <p className="text-3xl font-black" style={{ color: "var(--fg)" }}>{stat.value}</p>
                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* My Conferences */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--fg)" }}>My Conferences</h2>

              {delegatePasses.length > 0 && (
                <div className="card p-6 rounded-2xl mb-5">
                  <h3 className="font-bold mb-3" style={{ color: "var(--fg)" }}>Digital Delegate Passes</h3>
                  <div className="space-y-3">
                    {delegatePasses.map((pass) => (
                      <div key={pass.id} className="p-4 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{pass.eventName}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              {pass.categoryName} · {pass.committeeName || "No committee"} · {pass.portfolioName || "No portfolio"}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              Registration ID: {pass.registrationId}
                            </p>
                            {!pass.released && (
                              <p className="text-xs mt-1" style={{ color: "#d97706" }}>
                                Pass releases at {new Date(pass.releaseAt).toLocaleString()}
                              </p>
                            )}
                            {pass.checkedIn && (
                              <p className="text-xs mt-1" style={{ color: "#16a34a" }}>
                                Checked in at {pass.checkedInAt ? new Date(pass.checkedInAt).toLocaleString() : "event gate"}
                              </p>
                            )}
                          </div>
                          {pass.released && pass.qrImageDataUrl ? (
                            <div className="text-center">
                              <Image
                                src={pass.qrImageDataUrl}
                                alt="Delegate QR code"
                                width={112}
                                height={112}
                                className="w-28 h-28 rounded-lg bg-white p-2"
                              />
                              <a
                                href={pass.qrImageDataUrl}
                                download={`delegate-pass-${pass.registrationId}.png`}
                                className="btn btn-ghost text-xs mt-2"
                              >
                                Download Pass
                              </a>
                            </div>
                          ) : (
                            <span className="badge badge-gold">Locked</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {registrations.length === 0 ? (
                <div
                  className="py-20 text-center rounded-3xl"
                  style={{ border: "2px dashed var(--border)", background: "var(--bg)" }}
                >
                  <p className="text-5xl mb-4">🎓</p>
                  <h3 className="text-xl font-bold mb-2" style={{ color: "var(--fg)" }}>No conferences yet</h3>
                  <p className="text-sm mb-5" style={{ color: "var(--fg-muted)" }}>Start your MUN journey by finding your first conference.</p>
                  <Link href="/marketplace" className="btn btn-primary text-sm">Browse Marketplace →</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {registrations.map((reg) => {
                    const conf = CONFERENCES.find(c => c.id === reg.conferenceId);
                    return (
                      <div key={reg.id} className="card p-6 rounded-2xl">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${conf?.color ?? "from-blue-500 to-indigo-600"}`}
                          >
                            <span className="text-white font-black text-xl">M</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <h3 className="font-bold text-base" style={{ color: "var(--fg)" }}>
                                {reg.conferenceTitle}
                              </h3>
                              <span className={`badge ${STATUS_STYLE[reg.status]?.class ?? "badge-gray"}`}>
                                {reg.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                              <span>🏛️ Assigned: {reg.assignedCommitteeName || reg.committeeName || "Pending"}</span>
                              <span>📌 Portfolio: {reg.assignedPortfolioName || "Not assigned"}</span>
                              <span>🏳️ {reg.country}</span>
                              <span>📂 {reg.categoryName}</span>
                              <span>📅 Registered {reg.registeredAt}</span>
                            </div>
                            <div className="mt-2">
                              <span className={`badge ${
                                reg.organizerStatus === "Allotted"
                                  ? "badge-green"
                                  : reg.organizerStatus === "Waitlisted"
                                    ? "badge-gold"
                                    : reg.organizerStatus === "Rejected"
                                      ? "badge-gray"
                                      : "badge-blue"
                              }`}>
                                Organizer Status: {reg.organizerStatus || "Pending"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                          <div className="flex items-center gap-2">
                            <span
                              className="badge text-[10px]"
                              style={{ background: reg.paid ? "#dcfce7" : "#fef2f2", color: reg.paid ? "#16a34a" : "#dc2626" }}
                            >
                              {reg.paid ? "✓ Paid" : "Pending Payment"}
                            </span>
                            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>${reg.amount}</span>
                          </div>
                          <div className="flex gap-2">
                            <Link
                              href={`/conference/${reg.conferenceId}`}
                              className="btn btn-ghost text-xs"
                              style={{ padding: "6px 14px", borderRadius: "8px" }}
                            >
                              View Conference
                            </Link>
                            <Link
                              href="/resolution-copilot"
                              className="btn btn-outline-blue text-xs"
                              style={{ padding: "6px 14px", borderRadius: "8px" }}
                            >
                              Write Resolution
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              {/* Profile card */}
              <div className="card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: "var(--fg)" }}>My Profile</h3>
                  {!isEditingProfile ? (
                    <button onClick={startEditingProfile} className="btn btn-ghost text-xs">Edit</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingProfile(false)} className="btn btn-ghost text-xs">Cancel</button>
                      <button onClick={saveProfile} className="btn btn-primary text-xs">Save</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-2xl"
                    style={{ background: "linear-gradient(135deg, #2563eb, #60a5fa)" }}
                  >
                    {user.avatar}
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: "var(--fg)" }}>{user.name}</p>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user.email}</p>
                  </div>
                </div>
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={draftSchool}
                        onChange={(event) => setDraftSchool(event.target.value)}
                        className="input-base text-xs"
                        placeholder="School"
                      />
                      <input
                        value={draftCountry}
                        onChange={(event) => setDraftCountry(event.target.value)}
                        className="input-base text-xs"
                        placeholder="Country"
                      />
                    </div>
                    <textarea
                      value={draftExperienceSummary}
                      onChange={(event) => setDraftExperienceSummary(event.target.value)}
                      className="input-base text-xs"
                      rows={3}
                      placeholder="MUN experience summary"
                    />
                    <textarea
                      value={draftAwardsSummary}
                      onChange={(event) => setDraftAwardsSummary(event.target.value)}
                      className="input-base text-xs"
                      rows={3}
                      placeholder="Awards summary"
                    />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Participations</p>
                        <button onClick={addParticipation} className="btn btn-ghost text-xs">+ Add</button>
                      </div>
                      {draftParticipations.map((entry, index) => (
                        <div key={entry.id} className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => moveParticipation(entry.id, "up")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === 0}
                              aria-label="Move participation up"
                            >
                              <span aria-hidden>↑</span>
                            </button>
                            <button
                              onClick={() => moveParticipation(entry.id, "down")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === draftParticipations.length - 1}
                              aria-label="Move participation down"
                            >
                              <span aria-hidden>↓</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.conferenceName} onChange={(event) => updateParticipation(entry.id, { conferenceName: event.target.value })} className="input-base text-xs" placeholder="Conference" />
                            <input value={entry.committee || ""} onChange={(event) => updateParticipation(entry.id, { committee: event.target.value })} className="input-base text-xs" placeholder="Committee" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.role || ""} onChange={(event) => updateParticipation(entry.id, { role: event.target.value })} className="input-base text-xs" placeholder="Role" />
                            <input value={entry.countryRepresented || ""} onChange={(event) => updateParticipation(entry.id, { countryRepresented: event.target.value })} className="input-base text-xs" placeholder="Country represented" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={entry.year ?? ""}
                              onChange={(event) => updateParticipation(entry.id, { year: event.target.value ? Number(event.target.value) : undefined })}
                              className="input-base text-xs"
                              placeholder="Year"
                            />
                            <button onClick={() => removeParticipation(entry.id)} className="btn btn-ghost text-xs">Remove</button>
                          </div>
                          <textarea value={entry.notes || ""} onChange={(event) => updateParticipation(entry.id, { notes: event.target.value })} className="input-base text-xs" rows={2} placeholder="Notes" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Awards</p>
                        <button onClick={addAward} className="btn btn-ghost text-xs">+ Add</button>
                      </div>
                      {draftAwards.map((entry, index) => (
                        <div key={entry.id} className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => moveAward(entry.id, "up")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === 0}
                              aria-label="Move award up"
                            >
                              <span aria-hidden>↑</span>
                            </button>
                            <button
                              onClick={() => moveAward(entry.id, "down")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === draftAwards.length - 1}
                              aria-label="Move award down"
                            >
                              <span aria-hidden>↓</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.title} onChange={(event) => updateAward(entry.id, { title: event.target.value })} className="input-base text-xs" placeholder="Award title" />
                            <input value={entry.conferenceName} onChange={(event) => updateAward(entry.id, { conferenceName: event.target.value })} className="input-base text-xs" placeholder="Conference" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.category || ""} onChange={(event) => updateAward(entry.id, { category: event.target.value })} className="input-base text-xs" placeholder="Category" />
                            <input value={entry.committee || ""} onChange={(event) => updateAward(entry.id, { committee: event.target.value })} className="input-base text-xs" placeholder="Committee" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={entry.year ?? ""}
                              onChange={(event) => updateAward(entry.id, { year: event.target.value ? Number(event.target.value) : undefined })}
                              className="input-base text-xs"
                              placeholder="Year"
                            />
                            <button onClick={() => removeAward(entry.id)} className="btn btn-ghost text-xs">Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>School</span>
                      <span className="font-medium text-right max-w-[180px] text-xs" style={{ color: "var(--fg)" }}>{user.school}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>Country</span>
                      <span className="font-medium" style={{ color: "var(--fg)" }}>{user.country}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>MUN Experience</p>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user.munExperienceSummary || "No experience summary added."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>Awards Summary</p>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user.munAwardsSummary || "No awards summary added."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>
                        Participations ({user.munParticipations?.length || 0})
                      </p>
                      <div className="space-y-1">
                        {(user.munParticipations || []).slice(0, 2).map((entry) => (
                          <p key={entry.id} className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            {entry.conferenceName} {entry.year ? `(${entry.year})` : ""} {entry.committee ? `· ${entry.committee}` : ""}
                          </p>
                        ))}
                        {(user.munParticipations || []).length === 0 && (
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>No participations added yet.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>
                        Awards ({user.munAwards?.length || 0})
                      </p>
                      <div className="space-y-1">
                        {(user.munAwards || []).slice(0, 2).map((entry) => (
                          <p key={entry.id} className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            {entry.title} · {entry.conferenceName} {entry.year ? `(${entry.year})` : ""}
                          </p>
                        ))}
                        {(user.munAwards || []).length === 0 && (
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>No awards added yet.</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/delegates/${user.id}`} className="btn btn-ghost text-xs w-full">
                      View Public Profile
                    </Link>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="card p-6 rounded-2xl">
                <h3 className="font-bold mb-4" style={{ color: "var(--fg)" }}>Quick Actions</h3>
                <div className="space-y-2">
                  {[
                    { icon: "📋", label: "Write a Resolution", href: "/resolution-copilot" },
                    { icon: "🌍", label: "Browse Conferences", href: "/marketplace" },
                    { icon: "🔔", label: "View Notifications", href: "/notifications" },
                    { icon: "🏢", label: "Organizer Dashboard", href: "/organizers/dashboard" },
                  ].map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                      style={{ background: "var(--bg-subtle)", color: "var(--fg)" }}
                    >
                      <span className="text-lg">{action.icon}</span>
                      {action.label}
                      <span className="ml-auto" style={{ color: "var(--fg-muted)" }}>→</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="card p-6 rounded-2xl">
                <h3 className="font-bold mb-4" style={{ color: "var(--fg)" }}>Recent Notifications</h3>
                {mergedNotifications.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No updates yet.</p>
                ) : (
                  <div className="space-y-2">
                    {mergedNotifications.slice(0, 3).map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => markNotificationRead(notification.id)}
                        className="w-full text-left rounded-xl p-3"
                        style={{ background: "var(--bg-subtle)" }}
                      >
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{notification.title}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{notification.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* MUN Tips */}
              <div
                className="p-6 rounded-2xl"
                style={{ background: "linear-gradient(135deg, var(--blue), #60a5fa)", border: "none" }}
              >
                <h3 className="font-bold mb-2 text-white">💡 Tip of the Day</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Start preparing your position paper at least 2 weeks before the conference. Research your country&apos;s official UN voting history for strong arguments.
                </p>
                <Link
                  href="/resolution-copilot"
                  className="mt-4 btn text-sm font-bold"
                  style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px" }}
                >
                  Try AI Copilot →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
