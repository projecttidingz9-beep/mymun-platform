"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import ConferenceCard from "@/components/ConferenceCard";
import { CONFERENCES } from "@/lib/data";

const STATS = [
  { value: "50K+", label: "Active Delegates" },
  { value: "200+", label: "Conferences Yearly" },
  { value: "80+", label: "Countries Represented" },
  { value: "98%", label: "Delegate Satisfaction" },
];

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
      </svg>
    ),
    bg: "from-blue-500 to-indigo-600",
    title: "Global Conference Marketplace",
    desc: "Discover hundreds of MUN conferences worldwide. Filter by location, level, date, and committee type. Book your seat in minutes.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
        <path d="M12 2a10 10 0 0 1 10 10H12V2z" /><circle cx="12" cy="12" r="3" fill="white" />
        <path d="M12 22a10 10 0 0 1-10-10" strokeLinecap="round" />
      </svg>
    ),
    bg: "from-violet-500 to-purple-600",
    title: "AI Resolution Copilot",
    desc: "Draft resolutions with AI-powered assistance. Real-time policy validation, preambulatory suggestions, operative clause formatting, and country-policy checks.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" strokeLinecap="round" />
      </svg>
    ),
    bg: "from-emerald-500 to-teal-600",
    title: "Seamless Payments",
    desc: "Secure, multi-currency registration payments. Group delegation invoicing, scholarship applications, and instant digital confirmation.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
      </svg>
    ),
    bg: "from-amber-500 to-orange-600",
    title: "Delegate Dashboard",
    desc: "Track all your conferences, committee assignments, and country delegations in one place. Download certificates and manage your MUN portfolio.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    bg: "from-rose-500 to-pink-600",
    title: "Organizer Tools",
    desc: "Full conference management suite. Create committees, manage registrations, process payments, publish schedules, and communicate with delegates.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    bg: "from-cyan-500 to-blue-600",
    title: "Position Papers & Research",
    desc: "AI-assisted country research, position paper templates, and topic brief summaries. Be the most prepared delegate in the room.",
  },
];

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    school: "IIT Delhi",
    country: "🇮🇳",
    text: "Tidingz transformed how I approach MUN. Found DUMUN through the marketplace, registered in 5 minutes, and the AI Copilot helped me write my best resolution yet. Won Best Delegate!",
    conference: "Delhi University MUN 2026",
  },
  {
    name: "Lucas Fernandez",
    school: "Universidad de Buenos Aires",
    country: "🇦🇷",
    text: "As a first-time delegate, I was nervous. The platform's beginner-friendly filters helped me find the perfect conference. The resolution guide was invaluable — highly recommend.",
    conference: "MUN Online Global Summit",
  },
  {
    name: "Sophie Müller",
    school: "Humboldt University Berlin",
    country: "🇩🇪",
    text: "The organizer tools are exceptional. We ran BERMUN entirely through Tidingz — registrations, payment processing, schedule publishing. Saved us weeks of admin work.",
    conference: "Berlin Model Nations (Organizer)",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Discover", desc: "Browse our global marketplace of 200+ verified conferences, filtered to your level, interests, and location." },
  { step: "02", title: "Register", desc: "Select your committees, submit your country preferences, and pay securely — all in under 5 minutes." },
  { step: "03", title: "Prepare", desc: "Use our AI Copilot to research your country position, draft resolutions, and practice speeches." },
  { step: "04", title: "Participate", desc: "Attend the conference, track your performance, and earn your verified certificate of participation." },
];

export default function HomePage() {
  const [authOpen, setAuthOpen] = useState(false);
  const featured = CONFERENCES.filter((c) => c.featured).slice(0, 3);

  return (
    <>
      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
        {/* Background gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.1) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center w-full">
          <div className="space-y-8 animate-fade-up">
            <div className="section-label">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" style={{ animation: "pulse 2s infinite" }} />
              The Future of MUN is Here
            </div>

            <h1
              className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05]"
              style={{ color: "var(--fg)" }}
            >
              Empowering the{" "}
              <span className="text-gradient">Next Generation</span>
              {" "}of Global Leaders.
            </h1>

            <p className="text-lg leading-relaxed max-w-xl" style={{ color: "var(--fg-muted)" }}>
              Discover, organize, and participate in Model UN conferences worldwide. From AI-powered resolution drafting to seamless registration — your MUN journey starts here.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/marketplace" className="btn btn-primary text-base" style={{ padding: "14px 28px", borderRadius: "14px" }}>
                Browse Conferences →
              </Link>
              <button
                onClick={() => setAuthOpen(true)}
                className="btn btn-ghost text-base"
                style={{ padding: "14px 28px", borderRadius: "14px" }}
              >
                Get Started Free
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              {STATS.map((s) => (
                <div key={s.label} className="space-y-1">
                  <p className="text-2xl font-black text-gradient">{s.value}</p>
                  <p className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero image */}
          <div className="relative animate-fade-up delay-200">
            <div
              className="relative rounded-[2.5rem] overflow-hidden shadow-2xl"
              style={{ height: "560px" }}
            >
              <Image
                src="/hero.png"
                alt="MUN Conference — delegates at the UN assembly"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />
              {/* Floating card */}
              <div
                className="absolute bottom-6 left-6 right-6 p-5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="badge" style={{ background: "rgba(37,99,235,0.8)", color: "white" }}>🔴 Live Now</span>
                  <span className="text-white/60 text-xs">2,400 watching</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-1">Singapore International MUN 2026</h3>
                <p className="text-white/70 text-sm">UNSC • UNGA • SOCHUM  ·  487 delegates registered</p>
              </div>
            </div>

            {/* Floating badge top-right */}
            <div
              className="absolute -top-4 -right-4 p-4 rounded-2xl animate-fade-up delay-300"
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                boxShadow: "var(--card-shadow)",
              }}
            >
              <p className="text-2xl font-black text-gradient">200+</p>
              <p className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>Conferences</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }} className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mx-auto mb-4">How It Works</div>
            <h2 className="text-4xl font-black tracking-tight" style={{ color: "var(--fg)" }}>
              From discovery to{" "}
              <span className="text-gradient">Best Delegate</span>
            </h2>
            <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: "var(--fg-muted)" }}>
              Everything you need to succeed at any MUN conference, in four simple steps.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className="p-6 rounded-2xl animate-fade-up"
                style={{
                  background: "var(--bg)",
                  border: "1.5px solid var(--border)",
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl mb-5"
                  style={{ background: "var(--blue-subtle)", color: "var(--blue)" }}
                >
                  {step.step}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--fg)" }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mx-auto mb-4">Platform Features</div>
            <h2 className="text-4xl font-black tracking-tight" style={{ color: "var(--fg)" }}>
              Everything you need to{" "}
              <span className="text-gradient">Succeed</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card p-7 rounded-2xl group"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.bg} flex items-center justify-center mb-5 transition-transform group-hover:scale-110`}
                >
                  {f.icon}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--fg)" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Conferences ── */}
      <section style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }} className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="section-label mb-4">In The Spotlight</div>
              <h2 className="text-4xl font-black tracking-tight" style={{ color: "var(--fg)" }}>
                Featured <span className="text-gradient">Conferences</span>
              </h2>
            </div>
            <Link href="/marketplace" className="btn btn-ghost text-sm hidden md:flex">
              View All →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {featured.map((c) => (
              <ConferenceCard key={c.id} conference={c} featured />
            ))}
          </div>
          <div className="mt-8 text-center md:hidden">
            <Link href="/marketplace" className="btn btn-ghost">View All Conferences →</Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mx-auto mb-4">Testimonials</div>
            <h2 className="text-4xl font-black tracking-tight" style={{ color: "var(--fg)" }}>
              Loved by delegates{" "}
              <span className="text-gradient">worldwide</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="card p-6 rounded-2xl space-y-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, s) => (
                    <span key={s} className="text-amber-400 text-lg">★</span>
                  ))}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #2563eb, #60a5fa)" }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>{t.country} {t.name}</p>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{t.school}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div
            className="rounded-3xl p-12 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)" }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
                backgroundSize: "60px 60px",
              }}
            />
            <div className="relative">
              <h2 className="text-4xl font-black text-white mb-4">
                Ready to represent your country? 🌍
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                Join 50,000+ delegates already using Tidingz. Your next Best Delegate award is waiting.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setAuthOpen(true)}
                  className="btn text-base font-bold"
                  style={{
                    background: "white",
                    color: "#1e40af",
                    padding: "14px 32px",
                    borderRadius: "14px",
                  }}
                >
                  Create Free Account
                </button>
                <Link
                  href="/marketplace"
                  className="btn text-base font-bold"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "white",
                    border: "1.5px solid rgba(255,255,255,0.3)",
                    padding: "14px 32px",
                    borderRadius: "14px",
                  }}
                >
                  Browse Conferences
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
