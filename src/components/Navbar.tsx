"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AuthModal from "./AuthModal";
import BrandLogo from "./BrandLogo";
import { shouldForceDarkBrandLogo } from "@/lib/brand-logo-theme";
import {
  canAccessSuperDashboard,
  SUPER_ADMIN_HREF,
  SUPER_ADMIN_LABEL,
} from "@/lib/admin-nav";

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
      style={{
        background: "color-mix(in srgb, var(--accent-warm) 14%, var(--bg) 86%)",
        border: "1px solid color-mix(in srgb, var(--accent-warm) 32%, var(--border) 68%)",
        color: "var(--fg)",
      }}
    >
      {children}
    </span>
  );
}

const NAV_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "For Organizers", href: "/organizers" },
  { label: "Dashboard", href: "/dashboard" },
];
const INLINE_PRIORITY_HREFS = [SUPER_ADMIN_HREF, "/marketplace"];

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
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setHydrated(true);
      const storedTheme = localStorage.getItem("tidingz_dark");
      const domDark = document.documentElement.classList.contains("dark");
      setDarkMode(storedTheme === null ? domDark : storedTheme === "true");
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    const syncThemeFromStorage = () => {
      const storedTheme = localStorage.getItem("tidingz_dark");
      const domDark = document.documentElement.classList.contains("dark");
      setDarkMode(storedTheme === null ? domDark : storedTheme === "true");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "tidingz_dark") return;
      syncThemeFromStorage();
    };
    const onThemeChanged = () => {
      syncThemeFromStorage();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("tidingz-theme-change", onThemeChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tidingz-theme-change", onThemeChanged);
    };
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const toggleDark = () => {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    localStorage.setItem("tidingz_dark", String(nextDark));
    setDarkMode(nextDark);
    window.dispatchEvent(new Event("tidingz-theme-change"));
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
  const hideThemeToggle = pathname === "/";
  const currentRole = user?.role || "delegate";
  const showSuperDashboard = canAccessSuperDashboard(currentRole, user?.email);
  const roleNavLinks = showSuperDashboard
    ? [{ label: SUPER_ADMIN_LABEL, href: SUPER_ADMIN_HREF }, ...NAV_LINKS]
    : NAV_LINKS;
  const visibleNavLinks = showLoggedInUi
    ? roleNavLinks.filter((link) => {
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
    : roleNavLinks;
  const inlinePrimaryLinks = visibleNavLinks.filter((link) =>
    INLINE_PRIORITY_HREFS.includes(link.href),
  );

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 pt-[env(safe-area-inset-top,0px)] transition-all duration-300 ${
          scrolled ? "glass shadow-md shadow-black/5" : "bg-transparent"
        }`}
        style={{ borderBottom: scrolled ? "1px solid var(--glass-border)" : "none" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[76px] min-h-[76px] flex items-center justify-between gap-2 min-w-0">
          {/* Logo */}
          <Link href="/" className="flex items-center group min-w-0 shrink-0">
            <BrandLogo
              variant="horizontal"
              themeOverride={shouldForceDarkBrandLogo(pathname) ? "dark" : undefined}
              className="h-9 w-auto sm:h-10 max-w-[min(100%,240px)] object-contain object-left transition-transform group-hover:scale-[1.02]"
              priority
            />
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
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0 shrink md:min-w-[196px]">
            {/* Dark mode toggle */}
            {!hideThemeToggle ? (
              <button
                onClick={toggleDark}
                className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all touch-manipulation"
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
            ) : (
              <div aria-hidden className="w-11 h-11 sm:w-9 sm:h-9 shrink-0" />
            )}

            {showLoggedInUi ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all min-h-[44px] sm:min-h-0 touch-manipulation"
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
                    className="absolute right-0 top-full mt-2 min-w-[290px] max-w-[min(92vw,360px)] rounded-2xl overflow-hidden animate-slide-down user-menu-dropdown"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
                      zIndex: 100,
                    }}
                  >
                    <div className="px-5 py-4 border-b user-menu-identity" style={{ borderColor: "var(--border)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{user?.name}</p>
                      <p className="text-xs break-all mt-1" style={{ color: "var(--fg-muted)" }}>{user?.email}</p>
                    </div>
                    <div className="py-1.5">
                      {showSuperDashboard && (
                        <Link
                          href={SUPER_ADMIN_HREF}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors user-menu-link"
                          style={{ color: "var(--fg)" }}
                        >
                          <MenuIcon>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 3v18M3 12h18" strokeLinecap="round" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </MenuIcon>
                          {SUPER_ADMIN_LABEL}
                        </Link>
                      )}
                      {currentRole !== "organizer" && (
                        <>
                          <Link
                            href="/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors user-menu-link"
                            style={{ color: "var(--fg)" }}
                          >
                            <MenuIcon>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="7" y="12" width="3" height="6" rx="1" />
                                <rect x="12" y="9" width="3" height="9" rx="1" />
                                <rect x="17" y="6" width="3" height="12" rx="1" />
                              </svg>
                            </MenuIcon>
                            Dashboard
                          </Link>
                          <Link
                            href="/dashboard#profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors user-menu-link"
                            style={{ color: "var(--fg)" }}
                          >
                            <MenuIcon>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 1-3 0 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 1 0-3 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 1 3 0 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.37.4.8.6 1 .73.11 1.4.47 1.4 2s-.67 1.89-1.4 2c-.2.2-.36.63-.6 1Z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </MenuIcon>
                            Settings
                          </Link>
                        </>
                      )}
                      {currentRole !== "delegate" && (
                        <Link
                          href="/organizers/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors user-menu-link"
                          style={{ color: "var(--fg)" }}
                        >
                          <MenuIcon>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="4" y="3" width="16" height="18" rx="2" />
                              <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" strokeLinecap="round" />
                            </svg>
                          </MenuIcon>
                          Organizer Dashboard
                        </Link>
                      )}
                    </div>

                    <div className="border-t py-1.5" style={{ borderColor: "var(--border)" }}>
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors user-menu-link"
                        style={{ color: "#dc2626" }}
                      >
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                          style={{
                            background: "rgba(220, 38, 38, 0.12)",
                            border: "1px solid rgba(220, 38, 38, 0.28)",
                            color: "#dc2626",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAuthClick}
                  className="hidden sm:inline-flex px-4 py-2 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 min-h-[44px] items-center justify-center"
                  style={{ color: "var(--fg-muted)", border: "1px solid transparent" }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={handleAuthClick}
                  className="lux-button-primary text-sm hover:-translate-y-0.5 min-h-[44px] sm:min-h-0 px-4 sm:px-5 touch-manipulation inline-flex items-center justify-center"
                  style={{ padding: "10px 20px" }}
                >
                  Get Started
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="md:hidden w-11 h-11 shrink-0 rounded-xl flex items-center justify-center touch-manipulation"
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
            className="md:hidden px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] animate-slide-down max-h-[min(70vh,calc(100dvh-5rem))] overflow-y-auto overscroll-contain"
            style={{
              background: "var(--bg)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div className="pt-4 flex flex-col gap-2">
              {visibleNavLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="min-h-[48px] px-4 py-3 rounded-xl text-sm font-medium flex items-center touch-manipulation"
                  style={{ color: "var(--fg)", background: "var(--bg-subtle)" }}
                >
                  {l.label}
                </Link>
              ))}
              {!isLoggedIn && (
                <button
                  type="button"
                  onClick={() => { setMobileOpen(false); handleAuthClick(); }}
                  className="btn btn-primary mt-2 min-h-[48px] touch-manipulation"
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
