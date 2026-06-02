"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import ScrollShell from "@/components/ScrollShell";
import Reveal from "@/components/Reveal";
import WebGLLoader from "@/components/3d/WebGLLoader";
import { useAuth } from "@/lib/auth-context";
import ConferenceCard from "@/components/ConferenceCard";
import type { Conference } from "@/lib/types";

const HeroScene = dynamic(() => import("@/components/3d/HeroScene"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(42% 52% at 50% 50%, rgba(216,172,114,0.22), transparent 70%)",
      }}
    />
  ),
});

const PILLARS = [
  {
    index: "01",
    title: "Discover",
    body: "A curated marketplace of global MUN conferences, surfaced through intent, not noise.",
  },
  {
    index: "02",
    title: "Prepare",
    body: "Committee prep, portfolio tracking, and application tools — built for delegates who show up prepared.",
  },
  {
    index: "03",
    title: "Perform",
    body: "Seamless registration, communication, and recognition — from first speech to final gavel.",
  },
];

const MARQUEE = [
  "THE HAGUE",
  "HARVARD MUN",
  "GENEVA",
  "SINGAPORE",
  "DUMUN",
  "BERMUN",
  "WORLDMUN",
  "OXFORD",
];

const VEIL: React.CSSProperties = {
  background: "rgba(11, 13, 18, 0.86)",
  backdropFilter: "blur(14px) saturate(120%)",
  WebkitBackdropFilter: "blur(14px) saturate(120%)",
};

const VEIL_SOFT: React.CSSProperties = {
  background: "rgba(11, 13, 18, 0.78)",
  backdropFilter: "blur(10px) saturate(120%)",
  WebkitBackdropFilter: "blur(10px) saturate(120%)",
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  supabase_config: "Google sign-in is not configured. Use email and password, or add Supabase keys in your environment.",
  oauth: "Google sign-in was cancelled or failed.",
  oauth_exchange: "Could not complete Google sign-in. Try again.",
  oauth_user: "Could not read your Google account. Try again.",
  oauth_bridge: "Could not finish sign-in after Google. Try again or use email and password.",
};

export default function HomePage() {
  const { isLoggedIn, user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterNote, setNewsletterNote] = useState<string | null>(null);
  const [featuredConferences, setFeaturedConferences] = useState<Conference[]>([]);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneEnabled, setSceneEnabled] = useState(false);
  const openAuthModal = () => setAuthOpen(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/marketplace", { cache: "no-store" });
        const data = (await res.json()) as { conferences?: Conference[] };
        if (!cancelled && Array.isArray(data.conferences)) {
          setFeaturedConferences(data.conferences.slice(0, 3));
        }
      } catch {
        if (!cancelled) setFeaturedConferences([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (!error) return;
    const detail = params.get("detail");
    let message =
      OAUTH_ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again or use email and password.";
    if (error === "oauth_bridge" && detail) {
      message = `${message} (${detail})`;
    }
    setOauthNotice(message);
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("detail");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const subscribeNewsletter = async () => {
    setNewsletterNote(null);
    if (!newsletterEmail.includes("@")) {
      setNewsletterNote("Enter a valid email.");
      return;
    }
    setNewsletterBusy(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setNewsletterNote(data.error || "Could not subscribe.");
        return;
      }
      setNewsletterNote(data.message || "You’re on the list.");
      setNewsletterEmail("");
    } finally {
      setNewsletterBusy(false);
    }
  };
  const reduced = useReducedMotion();
  const scrollProgressRef = useRef(0);
  const isOrganizerUser = user?.role === "organizer" || user?.role === "admin";
  const shouldEnableScene =
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !window.matchMedia("(max-width: 768px)").matches;

  // Track overall scroll progress (0..1) and hand it to the WebGL scene so it
  // can evolve subtly from section to section (camera pull-back, drift, tilt).
  useEffect(() => {
    const update = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      scrollProgressRef.current =
        max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Safety net: if the GPU never reports a first frame within 4s (e.g. a
  // device rejected the WebGL context), hide the loader so the user is never
  // trapped behind it.
  useEffect(() => {
    if (!shouldEnableScene) return;
    const schedule = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (schedule) {
      schedule(() => setSceneEnabled(true));
    } else {
      window.setTimeout(() => setSceneEnabled(true), 350);
    }
  }, [shouldEnableScene]);

  useEffect(() => {
    if (sceneReady) return;
    const t = window.setTimeout(() => setSceneReady(true), 4000);
    return () => window.clearTimeout(t);
  }, [sceneReady]);

  return (
    <ScrollShell>
      <div className="lux-shell lux-shell-immersive min-h-screen flex flex-col">
        <WebGLLoader visible={sceneEnabled && !sceneReady} />

        {/* Persistent WebGL backdrop. One canvas carries the aesthetic across
            every section, giving the page continuous 3D presence without the
            overhead of a second context. */}
        <div
          aria-hidden
          className="fixed inset-0 z-0 pointer-events-none"
          style={{ background: "#0b0d12" }}
        >
          {sceneEnabled ? (
            <HeroScene
              scrollProgressRef={scrollProgressRef}
              onFirstFrame={() => setSceneReady(true)}
            />
          ) : null}
        </div>

        <Navbar openAuthModal={openAuthModal} />
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

        {oauthNotice ? (
          <div
            className="mx-auto max-w-3xl px-4 pt-4"
            role="alert"
          >
            <div
              className="flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(157, 46, 46, 0.12)",
                color: "#f4c4c4",
                border: "1px solid rgba(157, 46, 46, 0.28)",
              }}
            >
              <span>{oauthNotice}</span>
              <button
                type="button"
                className="shrink-0 text-white/70 hover:text-white"
                onClick={() => setOauthNotice(null)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ) : null}

        <main className="flex-1">
        {/* ───── Hero ───── */}
        <section className="relative lux-section min-h-[100dvh] flex items-center overflow-hidden">
          <div className="absolute inset-0 lux-grain pointer-events-none" />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(11,13,18,0.05) 0%, rgba(11,13,18,0.35) 55%, rgba(11,13,18,0.9) 100%)",
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full pt-[calc(7rem+env(safe-area-inset-top,0px))] pb-16 sm:pb-20">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
              className="mb-10"
            >
              <span className="lux-pill">
                <span className="lux-pill-dot" />
                Tidingz · Season 2026
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1.3,
                delay: 0.1,
                ease: [0.2, 0.7, 0.2, 1],
              }}
              className="lux-display-xl max-w-5xl"
              style={{ color: "var(--fg-immersive)" }}
            >
              The quiet architecture
              <br />
              of{" "}
              <span
                style={{
                  background:
                    "linear-gradient(120deg, #e7c390 10%, #f4e2c6 50%, #b28b57 90%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                modern diplomacy.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1.1,
                delay: 0.35,
                ease: [0.2, 0.7, 0.2, 1],
              }}
              className="lux-subdisplay max-w-xl mt-8"
            >
              A platform for the next generation of delegates and organizers.
              Designed with restraint, engineered for performance.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1.1,
                delay: 0.5,
                ease: [0.2, 0.7, 0.2, 1],
              }}
              className="mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto"
            >
              {!isLoggedIn ? (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="lux-button-primary text-base w-full sm:w-auto inline-flex justify-center items-center min-h-[48px] touch-manipulation"
                  style={{ padding: "16px 34px" }}
                >
                  Begin your journey
                </button>
              ) : (
                <Link
                  href={isOrganizerUser ? "/organizers/dashboard" : "/marketplace"}
                  className="lux-button-primary text-base w-full sm:w-auto inline-flex justify-center items-center min-h-[48px] touch-manipulation"
                  style={{ padding: "16px 34px" }}
                >
                  {isOrganizerUser ? "Go to organizer dashboard" : "Continue to marketplace"}
                </Link>
              )}
              <Link
                href="/marketplace"
                className="lux-button-ghost text-base w-full sm:w-auto inline-flex justify-center items-center min-h-[48px] touch-manipulation"
                style={{
                  padding: "16px 30px",
                  color: "var(--fg-immersive)",
                  borderColor: "rgba(243,237,224,0.28)",
                  background: "rgba(243,237,224,0.03)",
                }}
              >
                Browse conferences
              </Link>
            </motion.div>
          </div>

          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs tracking-[0.3em] uppercase z-10"
            style={{ color: "rgba(243,237,224,0.44)" }}
          >
            Scroll
          </motion.div>
        </section>

        {/* ───── Philosophy ───── */}
        <section
          id="philosophy"
          className="relative lux-section py-24 sm:py-32 lg:py-40 px-4 sm:px-6"
          style={VEIL_SOFT}
        >
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
                Philosophy
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="lux-display mt-6"
                style={{ color: "var(--fg-immersive)" }}
              >
                We believe diplomacy is a craft — practiced with patience,
                precision, and presence.
              </h2>
            </Reveal>
            <Reveal delay={0.25}>
              <div className="lux-hairline mt-16" />
            </Reveal>
          </div>
        </section>

        {/* ───── Pillars ───── */}
        <section className="relative lux-section py-20 sm:py-28 lg:py-32 px-4 sm:px-6" style={VEIL}>
          <div className="max-w-7xl mx-auto">
            <Reveal>
              <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
                Platform
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="lux-display mt-6 max-w-3xl"
                style={{ color: "var(--fg-immersive)" }}
              >
                Three movements, one continuous arc.
              </h2>
            </Reveal>

            <div className="mt-20 grid md:grid-cols-3 gap-px bg-[rgba(243,237,224,0.08)]">
              {PILLARS.map((pillar, i) => (
                <motion.div
                  key={pillar.index}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{
                    duration: 1,
                    delay: reduced ? 0 : i * 0.12,
                    ease: [0.2, 0.7, 0.2, 1],
                  }}
                  whileHover={{ y: -4 }}
                  className="px-4 py-10 sm:p-10 md:p-12 transition-colors"
                  style={{ background: "rgba(11,13,18,0.94)" }}
                >
                  <p
                    className="text-xs tracking-[0.3em]"
                    style={{ color: "var(--accent-warm)" }}
                  >
                    {pillar.index}
                  </p>
                  <h3
                    className="mt-6 text-2xl md:text-3xl font-semibold"
                    style={{ color: "var(--fg-immersive)", letterSpacing: "-0.02em" }}
                  >
                    {pillar.title}
                  </h3>
                  <p
                    className="mt-4 leading-relaxed"
                    style={{ color: "var(--fg-immersive-muted)" }}
                  >
                    {pillar.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── Marquee ───── */}
        <section
          className="relative lux-section py-12 sm:py-16 px-4 sm:px-6 overflow-hidden"
          style={{
            ...VEIL_SOFT,
            borderTop: "1px solid rgba(243,237,224,0.08)",
            borderBottom: "1px solid rgba(243,237,224,0.08)",
          }}
        >
          <motion.div
            className="flex gap-16 whitespace-nowrap"
            animate={
              reduced
                ? undefined
                : { x: ["0%", "-50%"] }
            }
            transition={
              reduced
                ? undefined
                : { duration: 42, ease: "linear", repeat: Infinity }
            }
          >
            {[...MARQUEE, ...MARQUEE].map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="text-2xl md:text-3xl font-semibold tracking-[0.2em]"
                style={{ color: "rgba(243,237,224,0.3)" }}
              >
                {name}
                <span className="ml-16" style={{ color: "var(--accent-warm)" }}>
                  ◆
                </span>
              </span>
            ))}
          </motion.div>
        </section>

        {featuredConferences.length > 0 && (
        <section className="relative lux-section py-24 sm:py-32 lg:py-40 px-4 sm:px-6" style={VEIL}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
              <div>
                <Reveal>
                  <p
                    className="lux-eyebrow"
                    style={{ color: "rgba(243,237,224,0.55)" }}
                  >
                    Spotlight
                  </p>
                </Reveal>
                <Reveal delay={0.1}>
                  <h2
                    className="lux-display mt-6"
                    style={{ color: "var(--fg-immersive)" }}
                  >
                    Curated conferences.
                  </h2>
                </Reveal>
              </div>
              <Reveal delay={0.2}>
                <Link
                  href="/marketplace"
                  className="lux-button-ghost text-sm"
                  style={{
                    padding: "12px 22px",
                    color: "var(--fg-immersive)",
                    borderColor: "rgba(243,237,224,0.28)",
                    background: "rgba(243,237,224,0.03)",
                  }}
                >
                  View all
                </Link>
              </Reveal>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-10">
              {featuredConferences.map((conference) => (
                <ConferenceCard key={conference.id} conference={conference} />
              ))}
            </div>
          </div>
        </section>
        )}

        {/* ───── CTA ───── */}
        <section
          className="relative lux-section py-24 sm:py-32 lg:py-40 px-4 sm:px-6"
          style={VEIL_SOFT}
        >
          <div className="max-w-4xl mx-auto text-center">
            <Reveal>
              <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
                Join
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="lux-display-xl mt-8"
                style={{ color: "var(--fg-immersive)" }}
              >
                Step into the
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(120deg, #e7c390 10%, #f4e2c6 50%, #b28b57 90%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  next chapter.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="lux-subdisplay mt-8 max-w-xl mx-auto">
                Create your account in a minute. Your next conference, and the
                ones after, begin here.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="mt-12 flex justify-center">
                {!isLoggedIn ? (
                  <button
                    type="button"
                    onClick={openAuthModal}
                    className="lux-button-primary text-base"
                    style={{ padding: "16px 34px" }}
                  >
                    Create free account
                  </button>
                ) : (
                  <Link
                    href={isOrganizerUser ? "/organizers/dashboard" : "/marketplace"}
                    className="lux-button-primary text-base"
                    style={{ padding: "16px 34px" }}
                  >
                    {isOrganizerUser ? "Open organizer dashboard" : "Browse conferences"}
                  </Link>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───── Contact ───── */}
        <section id="contact" className="relative lux-section py-24 sm:py-32 lg:py-40 px-4 sm:px-6" style={VEIL_SOFT}>
          <div className="max-w-4xl mx-auto text-center">
            <Reveal>
              <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
                Contact
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2
                className="lux-display mt-6"
                style={{ color: "var(--fg-immersive)" }}
              >
                We&apos;d love to
                <br />
                hear from you.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="lux-subdisplay mt-8 max-w-xl mx-auto">
                Hosting a conference, exploring a partnership, or just have a
                question? Our team typically responds within one business day.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="mt-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none mx-auto">
                <a
                  href="mailto:hello@tidingz.com"
                  className="lux-button-ghost text-base inline-flex justify-center items-center min-h-[48px] w-full sm:w-auto touch-manipulation"
                  style={{ padding: "14px 30px" }}
                >
                  Email us →
                </a>
                <Link
                  href="/contact"
                  className="lux-button-ghost text-base inline-flex justify-center items-center min-h-[48px] w-full sm:w-auto touch-manipulation"
                  style={{ padding: "14px 30px" }}
                >
                  Contact form →
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="lux-hairline mt-20" />
              <div
                className="mt-12 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-left"
                style={{
                  background: "rgba(243,237,224,0.05)",
                  border: "1.5px solid rgba(243,237,224,0.12)",
                }}
              >
                <div>
                  <p
                    className="font-bold text-sm"
                    style={{ color: "var(--fg-immersive)" }}
                  >
                    Get conference alerts
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--fg-immersive-muted)" }}
                  >
                    New conferences and application deadlines, sent weekly.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <input
                      type="email"
                      aria-label="Email address for conference alerts"
                      placeholder="your@email.com"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className="flex-1 min-w-0 sm:w-60 text-sm px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        border: "1.5px solid rgba(243,237,224,0.18)",
                        color: "var(--fg-immersive)",
                      }}
                    />
                    <button
                      type="button"
                      className="lux-button-primary text-sm w-full sm:w-auto min-h-[48px] sm:min-h-0 touch-manipulation"
                      style={{ padding: "12px 22px", whiteSpace: "nowrap" }}
                      disabled={newsletterBusy}
                      onClick={subscribeNewsletter}
                    >
                      {newsletterBusy ? "…" : "Subscribe"}
                    </button>
                  </div>
                  {newsletterNote && (
                    <p className="text-xs" style={{ color: "var(--fg-immersive-muted)" }}>
                      {newsletterNote}
                    </p>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───── FAQ ───── */}
        <section className="relative lux-section py-22 sm:py-28 lg:py-36 px-4 sm:px-6" style={VEIL_SOFT}>
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
                FAQ
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="lux-display mt-6" style={{ color: "var(--fg-immersive)" }}>
                Common questions,
                <br />
                clear answers.
              </h2>
            </Reveal>

            <div className="lux-hairline mt-16" />

            <div className="mt-12 space-y-0">
              {[
                {
                  q: "Is Tidingz free for delegates?",
                  a: "Yes. Creating an account and browsing the marketplace are free. You only pay when you register for a conference, at the fee set by the organizer.",
                },
                {
                  q: "How do I register for a conference?",
                  a: "Browse the Marketplace, open a conference page, and click 'Apply Now'. Fill in your details, select a category, and complete payment. You will receive a confirmation email and can track your status from your dashboard.",
                },
                {
                  q: "Can I host my conference on Tidingz?",
                  a: "Absolutely. Head to the Organizers page and create your conference. You get a full suite: application management, delegate allotment, committee builder, QR delegate passes, and payment collection.",
                },
                {
                  q: "How do delegate passes and QR codes work?",
                  a: "Once an organizer allots and publishes passes, a QR code appears in your dashboard. Show it at the gate for instant check-in. Organizers can scan with any camera — no extra hardware needed.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-4% 0px" }}
                  transition={{
                    duration: 0.75,
                    delay: reduced ? 0 : i * 0.07,
                    ease: [0.2, 0.7, 0.2, 1],
                  }}
                  className="py-7"
                  style={{ borderBottom: "1px solid rgba(243,237,224,0.08)" }}
                >
                  <p
                    className="text-base font-bold mb-3"
                    style={{ color: "var(--fg-immersive)" }}
                  >
                    {item.q}
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--fg-immersive-muted)" }}
                  >
                    {item.a}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        </main>

        <Footer />
      </div>
    </ScrollShell>
  );
}
