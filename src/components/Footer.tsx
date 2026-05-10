import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Conferences", href: "/marketplace" },
  { label: "Contact", href: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms & Conditions", href: "/legal/terms" },
  { label: "Refund Policy", href: "/legal/refund" },
  { label: "Cookie Policy", href: "/legal/cookies" },
];

/** Add real profile URLs before showing icons — generic network homepages are misleading. */
const SOCIAL_LINKS: { label: string; href: string; icon: string }[] = [];

export default function Footer() {
  return (
    <footer className="relative z-10 w-full mt-auto footer-shell">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl overflow-hidden border footer-logo-wrap">
                <Image
                  src="/tidingz-logo.jpg"
                  alt="Tidingz logo"
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-lg font-bold tracking-tight footer-title">Tidingz</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-md footer-copy">
              A modern Model UN platform helping delegates and organizers discover, prepare, and perform at the highest level.
            </p>
            {SOCIAL_LINKS.length > 0 && (
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold footer-social"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-[0.2em] uppercase mb-4 footer-section-title">Navigation</h4>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm footer-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-[0.2em] uppercase mb-4 footer-section-title">Legal</h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm footer-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t footer-bottom-row">
          <p className="text-xs footer-copy">© 2026 Tidingz Technologies. All rights reserved.</p>
          <p className="text-xs footer-copy">Built for global delegates and organizers.</p>
        </div>
      </div>
    </footer>
  );
}
