"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import AuthModal from "./AuthModal";

const NAV_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Resolution Copilot", href: "/resolution-copilot" },
  { label: "For Organizers", href: "/organizers" },
  { label: "Dashboard", href: "/dashboard" },
];

interface NavbarProps {
  openAuthModal?: () => void;
}

export default function Navbar({ openAuthModal }: NavbarProps) {
  const { user, isLoggedIn, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    // Init dark mode from localStorage
    const saved = localStorage.getItem("tidingz_dark");
    if (saved === "true") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tidingz_dark", String(next));
  };

  const handleAuthClick = () => {
    if (openAuthModal) openAuthModal();
    else setAuthOpen(true);
  };

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

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: "var(--fg-muted)" }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = "var(--fg)";
                  (e.target as HTMLElement).style.background = "var(--bg-subtle)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = "var(--fg-muted)";
                  (e.target as HTMLElement).style.background = "transparent";
                }}
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
                background: "var(--bg-subtle)",
                border: "1.5px solid var(--border)",
                color: "var(--fg-muted)",
              }}
              title="Toggle dark mode"
            >
              {darkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v1m0 16v1M4.22 4.22l.7.7m12.16 12.16.7.7M1 12h1m20 0h1m-16.78 7.78.7-.7M18.36 5.64l.7-.7M12 6a6 6 0 0 0 0 12A6 6 0 0 0 12 6z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                </svg>
              )}
            </button>

            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                  style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                    style={{ background: "linear-gradient(135deg, #2563eb, #60a5fa)" }}
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
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                      style={{ color: "var(--fg)" }}
                    >
                      📊 Dashboard
                    </Link>
                    <Link
                      href="/organizers/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                      style={{ color: "var(--fg)" }}
                    >
                      🏢 Organizer Dashboard
                    </Link>
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
                  className="hidden sm:block px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Sign In
                </button>
                <button
                  onClick={handleAuthClick}
                  className="btn btn-primary text-sm"
                  style={{ padding: "10px 20px", borderRadius: "10px" }}
                >
                  Get Started
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}
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
              {NAV_LINKS.map((l) => (
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

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
