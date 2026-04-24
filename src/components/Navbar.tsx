"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AuthModal from "./AuthModal";

const NAV_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Resolution Copilot", href: "/resolution-copilot" },
  { label: "For Organizers", href: "/organizers" },
  { label: "Dashboard", href: "/dashboard" },
];
const INLINE_PRIORITY_HREFS = ["/marketplace", "/resolution-copilot"];

interface NavbarProps {
  openAuthModal?: () => void;
}

export default function Navbar({ openAuthModal }: NavbarProps) {
  const { user, isLoggedIn, logout } = useAuth();
  const pathname = usePathname() || "/";
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem("tidingz_dark");
      if (stored === "true") {
        setDarkMode(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("tidingz_dark", String(darkMode));
  }, [darkMode]);

  const toggleDark = () => {
    setDarkMode((prev) => !prev);
  };

  const handleAuthClick = () => {
    if (openAuthModal) {
      openAuthModal();
      return;
    }
    setAuthOpen(true);
  };

  const showLoggedInUi = hydrated && isLoggedIn;
  const showDarkModeOnIcon = hydrated && darkMode;
  const currentRole = user?.role || "delegate";
  const visibleNavLinks = showLoggedInUi
    ? NAV_LINKS.filter((link) => {
        if (link.href === "/marketplace") {
          return currentRole !== "organizer";
        }
        if (link.href === "/dashboard") {
          return currentRole !== "organizer";
        }
        if (link.href === "/organizers") {
          return currentRole !== "delegate";
        }
        return true;
      })
    : NAV_LINKS;
  const inlinePrimaryLinks = visibleNavLinks.filter((link) =>
    INLINE_PRIORITY_HREFS.includes(link.href),
  );

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? "glass shadow-md shadow-black/5" : "bg-transparent"
        }`}
        style={{ borderBottom: scrolled ? "1px solid var(--glass-border)" : "none" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg transition-transform group-hover:scale-105">
              <Image
                src="/tidingz-logo.png"
                alt="Tidingz logo"
                width={36}
                height={36}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--fg)" }}>
              Tidingz
            </span>
          </Link>

          {/* Mid-width inline nav (priority links) */}
          <div className="hidden sm:flex lg:hidden items-center gap-1">
            {inlinePrimaryLinks.map((l) => (
              <Link
                key={`${l.href}-inline`}
                href={l.href}
                data-active={isActive(l.href) ? "true" : "false"}
                className="nav-link-lux px-3 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop nav (full links) */}
          <div className="hidden lg:flex items-center gap-1">
            {visibleNavLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                data-active={isActive(l.href) ? "true" : "false"}
                className="nav-link-lux px-4 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: "color-mix(in srgb, var(--bg) 86%, transparent 14%)",
                border: "1.5px solid var(--border)",
                color: "var(--fg-muted)",
              }}
              title="Toggle dark mode"
            >
              {showDarkModeOnIcon ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v1m0 16v1M4.22 4.22l.7.7m12.16 12.16.7.7M1 12h1m20 0h1m-16.78 7.78.7-.7M18.36 5.64l.7-.7M12 6a6 6 0 0 0 0 12A6 6 0 0 0 12 6z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                </svg>
              )}
            </button>

            {showLoggedInUi ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                  style={{ background: "color-mix(in srgb, var(--bg) 84%, transparent 16%)", border: "1.5px solid var(--border)" }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                    style={{ background: "linear-gradient(135deg, #7f5d38, #b28b57)" }}
                  >
                    {user?.avatar}
                  </div>
                  <span className="text-sm font-medium hidden sm:block" style={{ color: "var(--fg)" }}>
                    {user?.name.split(" ")[0]}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--fg-muted)" }}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden animate-slide-down"
                    style={{
                      background: "var(--bg)",
                      border: "1.5px solid var(--border)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                      zIndex: 100,
                    }}
                  >
                    <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{user?.name}</p>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user?.email}</p>
                    </div>
                    {currentRole !== "organizer" && (
                      <>
                        <Link
                          href="/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                          style={{ color: "var(--fg)" }}
                        >
                          📊 Dashboard
                        </Link>
                        <Link
                          href={`/delegates/${user?.id || ""}`}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                          style={{ color: "var(--fg)" }}
                        >
                          🪪 Public Profile
                        </Link>
                      </>
                    )}
                    {currentRole !== "delegate" && (
                      <Link
                        href="/organizers/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                        style={{ color: "var(--fg)" }}
                      >
                        🏢 Organizer Dashboard
                      </Link>
                    )}
                    <Link
                      href="/resolution-copilot"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                      style={{ color: "var(--fg)" }}
                    >
                      ✍️ Resolution Copilot
                    </Link>
                    <div className="border-t" style={{ borderColor: "var(--border)" }}>
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                        style={{ color: "#dc2626" }}
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={handleAuthClick}
                  className="hidden sm:block px-4 py-2 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
                  style={{ color: "var(--fg-muted)", border: "1px solid transparent" }}
                >
                  Sign In
                </button>
                <button
                  onClick={handleAuthClick}
                  className="lux-button-primary text-sm hover:-translate-y-0.5"
                  style={{ padding: "10px 20px" }}
                >
                  Get Started
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--bg) 86%, transparent 14%)", border: "1.5px solid var(--border)" }}
              onClick={() => setMobileOpen((p) => !p)}
            >
              <div className="w-5 flex flex-col gap-1">
                <span
                  className="block h-0.5 rounded transition-all"
                  style={{
                    background: "var(--fg)",
                    transform: mobileOpen ? "rotate(45deg) translateY(6px)" : "none",
                  }}
                />
                <span
                  className="block h-0.5 rounded transition-all"
                  style={{
                    background: "var(--fg)",
                    opacity: mobileOpen ? 0 : 1,
                  }}
                />
                <span
                  className="block h-0.5 rounded transition-all"
                  style={{
                    background: "var(--fg)",
                    transform: mobileOpen ? "rotate(-45deg) translateY(-6px)" : "none",
                  }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="md:hidden px-6 pb-6 animate-slide-down"
            style={{
              background: "var(--bg)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div className="pt-4 flex flex-col gap-1">
              {visibleNavLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm font-medium"
                  style={{ color: "var(--fg)", background: "var(--bg-subtle)" }}
                >
                  {l.label}
                </Link>
              ))}
              {!isLoggedIn && (
                <button
                  onClick={() => { setMobileOpen(false); handleAuthClick(); }}
                  className="btn btn-primary mt-3"
                >
                  Sign In / Get Started
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {!openAuthModal && <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />}
    </>
  );
}
