"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { CONFERENCES } from "@/lib/data";

export default function DashboardPage() {
  const { user, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) router.push("/");
  }, [isLoggedIn, router]);

  if (!isLoggedIn || !user) return null;

  const registrations = user.registeredConferences;
  const totalPaid = registrations.filter(r => r.paid).reduce((sum, r) => sum + r.amount, 0);
  const confirmed = registrations.filter(r => r.status === "Confirmed").length;

  const STATUS_STYLE: Record<string, { class: string }> = {
    Confirmed: { class: "badge-green" },
    Waitlisted: { class: "badge-gold" },
    Pending: { class: "badge-gray" },
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
                              <span>🏛️ {reg.committeeName}</span>
                              <span>🏳️ {reg.country}</span>
                              <span>📅 Registered {reg.registeredAt}</span>
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
                <h3 className="font-bold mb-4" style={{ color: "var(--fg)" }}>My Profile</h3>
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
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--fg-muted)" }}>School</span>
                    <span className="font-medium text-right max-w-[180px] text-xs" style={{ color: "var(--fg)" }}>{user.school}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--fg-muted)" }}>Country</span>
                    <span className="font-medium" style={{ color: "var(--fg)" }}>{user.country}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card p-6 rounded-2xl">
                <h3 className="font-bold mb-4" style={{ color: "var(--fg)" }}>Quick Actions</h3>
                <div className="space-y-2">
                  {[
                    { icon: "📋", label: "Write a Resolution", href: "/resolution-copilot" },
                    { icon: "🌍", label: "Browse Conferences", href: "/marketplace" },
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
