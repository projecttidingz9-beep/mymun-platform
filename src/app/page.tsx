"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import ConferenceCard from "@/components/ConferenceCard";
import ScrollShell from "@/components/ScrollShell";
import Reveal from "@/components/Reveal";
import WebGLLoader from "@/components/3d/WebGLLoader";
import { CONFERENCES } from "@/lib/data";

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
    body: "An AI co-pilot for resolutions, research, and country policy — tuned for serious delegates.",
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

export default function HomePage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const openAuthModal = () => setAuthOpen(true);
  const featured = CONFERENCES.filter((c) => c.featured).slice(0, 3);
  const reduced = useReducedMotion();
  const scrollProgressRef = useRef(0);

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
    if (sceneReady) return;
    const t = window.setTimeout(() => setSceneReady(true), 4000);
    return () => window.clearTimeout(t);
  }, [sceneReady]);

  return (
    <ScrollShell>
      <div className="lux-shell lux-shell-immersive min-h-screen">
        <WebGLLoader visible={!sceneReady} />

        {/* Persistent WebGL backdrop. One canvas carries the aesthetic across
            every section, giving the page continuous 3D presence without the
            overhead of a second context. */}
        <div
          aria-hidden
          className="fixed inset-0 z-0 pointer-events-none"
          style={{ background: "#0b0d12" }}
        >
          <HeroScene
            scrollProgressRef={scrollProgressRef}
            onFirstFrame={() => setSceneReady(true)}
          />
        </div>

        <Navbar openAuthModal={openAuthModal} />
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

        {/* ───── Hero ───── */}
        <section className="relative lux-section min-h-[100vh] flex items-center overflow-hidden">
          <div className="absolute inset-0 lux-grain pointer-events-none" />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(11,13,18,0.05) 0%, rgba(11,13,18,0.35) 55%, rgba(11,13,18,0.9) 100%)",
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-28 pb-20">
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
              className="mt-12 flex flex-col sm:flex-row gap-4"
            >
              <button
                type="button"
                onClick={openAuthModal}
                className="lux-button-primary text-base"
                style={{ padding: "16px 34px" }}
              >
                Begin your journey
              </button>
              <Link
                href="/marketplace"
                className="lux-button-ghost text-base"
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
          className="relative lux-section py-40 px-6"
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
        <section className="relative lux-section py-32 px-6" style={VEIL}>
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
                  className="p-10 md:p-12 transition-colors"
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
          className="relative lux-section py-16 overflow-hidden"
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

        {/* ───── Featured conferences ───── */}
        <section className="relative lux-section py-40 px-6" style={VEIL}>
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

            <div className="grid md:grid-cols-3 gap-6">
              {featured.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 36 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{
                    duration: 1,
                    delay: reduced ? 0 : i * 0.1,
                    ease: [0.2, 0.7, 0.2, 1],
                  }}
                >
                  <ConferenceCard conference={c} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── CTA ───── */}
        <section
          className="relative lux-section py-40 px-6"
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
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="lux-button-primary text-base"
                  style={{ padding: "16px 34px" }}
                >
                  Create free account
                </button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───── Proof ───── */}
        <section className="relative lux-section py-36 px-6" style={VEIL}>
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
                Proof
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2
                className="lux-display mt-6"
                style={{ color: "var(--fg-immersive)" }}
              >
                Numbers that speak
                <br />
                for themselves.
              </h2>
            </Reveal>

            <div className="lux-hairline mt-16" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 mt-12">
              {[
                { value: "500+", label: "Delegates registered", sub: "across all conferences" },
                { value: "40+",  label: "Conferences hosted",   sub: "and growing every season" },
                { value: "30+",  label: "Countries represented", sub: "in our delegate community" },
                { value: "98%",  label: "Delegate satisfaction", sub: "based on post-event surveys" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-8% 0px" }}
                  transition={{
                    duration: 0.9,
                    delay: reduced ? 0 : i * 0.1,
                    ease: [0.2, 0.7, 0.2, 1],
                  }}
                  className="px-8 py-8 border-l first:border-l-0 border-b lg:border-b-0"
                  style={{
                    borderColor: "rgba(243,237,224,0.1)",
                  }}
                >
                  <p
                    className="text-5xl font-black tracking-tight"
                    style={{
                      background: "linear-gradient(120deg,#e7c390 10%,#f4e2c6 50%,#b28b57 90%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    className="mt-3 text-sm font-bold"
                    style={{ color: "var(--fg-immersive)" }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--fg-immersive-muted)" }}
                  >
                    {stat.sub}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── Contact ───── */}
        <section className="relative lux-section py-40 px-6" style={VEIL_SOFT}>
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
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:hello@tidingz.com"
                  className="lux-button-ghost text-base"
                  style={{ padding: "14px 30px" }}
                >
                  Email us →
                </a>
                <a
                  href="#"
                  className="lux-button-ghost text-base"
                  style={{ padding: "14px 30px" }}
                >
                  Follow on 𝕏
                </a>
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
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="flex-1 sm:w-60 text-sm px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1.5px solid rgba(243,237,224,0.18)",
                      color: "var(--fg-immersive)",
                    }}
                  />
                  <button
                    type="button"
                    className="lux-button-primary text-sm"
                    style={{ padding: "12px 22px", whiteSpace: "nowrap" }}
                  >
                    Subscribe
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───── Testimonials ───── */}
        <section className="relative lux-section py-36 px-6" style={VEIL}>
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
                Voices
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="lux-display mt-6" style={{ color: "var(--fg-immersive)" }}>
                What delegates
                <br />
                are saying.
              </h2>
            </Reveal>

            <div className="lux-hairline mt-16" />

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
                {
                  quote: "Tidingz made finding and registering for MUNs completely seamless. The resolution co-pilot alone saved me hours of research.",
                  name: "Priya S.",
                  detail: "Best Delegate · HMUN 2025",
                  initial: "P",
                },
                {
                  quote: "Running a 400-delegate conference used to mean spreadsheets and chaos. With Tidingz we handled everything — applications, allotments, passes — from one screen.",
                  name: "Marcus O.",
                  detail: "Secretary-General · DUMUN 2025",
                  initial: "M",
                },
                {
                  quote: "The platform feels built for serious delegates. The conference pages, the portfolio system, the QR passes — it is a whole level above anything else out there.",
                  name: "Aiko T.",
                  detail: "Delegate · WorldMUN 2025",
                  initial: "A",
                },
              ].map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-6% 0px" }}
                  transition={{
                    duration: 0.9,
                    delay: reduced ? 0 : i * 0.12,
                    ease: [0.2, 0.7, 0.2, 1],
                  }}
                  className="flex flex-col gap-6 rounded-2xl p-8"
                  style={{
                    background: "rgba(243,237,224,0.04)",
                    border: "1.5px solid rgba(243,237,224,0.1)",
                  }}
                >
                  {/* Quote mark */}
                  <span
                    className="text-4xl leading-none font-serif select-none"
                    style={{ color: "rgba(231,195,144,0.4)" }}
                    aria-hidden
                  >
                    &ldquo;
                  </span>
                  <p
                    className="text-sm leading-relaxed flex-1"
                    style={{ color: "var(--fg-immersive-muted)" }}
                  >
                    {t.quote}
                  </p>
                  <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid rgba(243,237,224,0.08)" }}>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#b28b57,#e7c390)",
                        color: "rgba(10,9,8,0.9)",
                      }}
                    >
                      {t.initial}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--fg-immersive)" }}>{t.name}</p>
                      <p className="text-xs" style={{ color: "rgba(243,237,224,0.38)" }}>{t.detail}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── FAQ ───── */}
        <section className="relative lux-section py-36 px-6" style={VEIL_SOFT}>
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
                  a: "Yes. Creating an account, browsing conferences, and using the Resolution Co-pilot are completely free. You only pay when you register for a conference, at the fee set by the organizer.",
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
                  q: "What is the Resolution Co-pilot?",
                  a: "An AI-powered writing assistant tuned for MUN. It helps you draft working papers, position papers, and amendments — grounded in your country's UN voting history and the committee's topic.",
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

        <Footer />
      </div>
    </ScrollShell>
  );
}
