"use client";

import { useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import Reveal from "@/components/Reveal";
import { useAuth } from "@/lib/auth-context";

const FEATURES_FOR_ORGANIZERS = [
  {
    title: "Committee Builder",
    desc: "Create committees, agendas, documents, and chair assignments from one dashboard.",
  },
  {
    title: "Registration Ops",
    desc: "Manage categories, pricing phases, and incoming applications with clear status flow.",
  },
  {
    title: "Allotments & Passes",
    desc: "Assign delegates to committees and issue passes with a streamlined organizer workflow.",
  },
  {
    title: "Announcements",
    desc: "Broadcast updates to delegates instantly without juggling external tools.",
  },
  {
    title: "Insights",
    desc: "Track seats, applications, and registration progress in real time.",
  },
  {
    title: "Publishing Control",
    desc: "Draft safely and publish only when your conference is ready for the marketplace.",
  },
];

export default function OrganizersPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const showLoggedInCta = hydrated && isLoggedIn;
  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"signin" | "register">("signin");

  const openAuthModal = (tab: "signin" | "register" = "signin") => {
    setAuthDefaultTab(tab);
    setAuthOpen(true);
  };

  const openCreateConference = () => {
    if (!isLoggedIn) {
      openAuthModal("register");
      return;
    }
    router.push("/organizers/create");
  };

  const openDashboard = () => {
    if (!isLoggedIn) {
      openAuthModal("signin");
      return;
    }
    router.push("/organizers/dashboard");
  };

  return (
    <div className="lux-shell lux-shell-immersive min-h-screen">
      <div aria-hidden className="lux-backdrop" />
      <Navbar openAuthModal={() => openAuthModal("signin")} />
      <AuthModal
        key={authDefaultTab}
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab={authDefaultTab}
      />

      <section className="relative lux-section pt-[calc(9rem+env(safe-area-inset-top,0px))] pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <span className="lux-pill">
            <span className="lux-pill-dot" />
            For Conference Organizers
          </span>
          <h1 className="lux-display-xl mt-10" style={{ color: "var(--fg-immersive)" }}>
            Build and run your conference,
            <br />
            from one platform.
          </h1>
          <p className="lux-subdisplay mt-8 max-w-2xl mx-auto">
            Create conference drafts, configure registrations, publish when ready, and
            manage your event lifecycle end-to-end.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center max-w-lg sm:max-w-none mx-auto">
            <button
              type="button"
              onClick={openCreateConference}
              className="lux-button-primary text-base w-full sm:w-auto inline-flex justify-center items-center min-h-[48px] touch-manipulation"
              style={{ padding: "16px 32px" }}
            >
              Create your conference
            </button>
            <button
              type="button"
              onClick={openDashboard}
              className="lux-button-ghost text-base w-full sm:w-auto inline-flex justify-center items-center min-h-[48px] touch-manipulation"
              style={{
                padding: "16px 28px",
                color: "var(--fg-immersive)",
                borderColor: "rgba(243,237,224,0.28)",
                background: "rgba(243,237,224,0.03)",
              }}
            >
              {showLoggedInCta ? "Open organizer dashboard" : "Sign in to dashboard"}
            </button>
          </div>
        </div>
      </section>

      <section className="relative lux-section py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Reveal>
              <p className="lux-eyebrow justify-center inline-flex" style={{ color: "rgba(243,237,224,0.55)" }}>
                Organizer Tools
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="lux-display mt-6" style={{ color: "var(--fg-immersive)" }}>
                Everything you need to go live.
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES_FOR_ORGANIZERS.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.04}>
                <div className="lux-card p-6 sm:p-7 h-full">
                  <p className="text-xs font-semibold" style={{ color: "var(--accent-warm)", letterSpacing: "0.24em", textTransform: "uppercase" }}>
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-4 text-xl font-semibold" style={{ color: "var(--fg-immersive)" }}>
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(243,237,224,0.68)" }}>
                    {feature.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
