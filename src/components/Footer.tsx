import Link from "next/link";

const FOOTER_LINKS = {
  Platform: [
    { label: "Marketplace", href: "/marketplace" },
    { label: "Resolution Copilot", href: "/resolution-copilot" },
    { label: "For Organizers", href: "/organizers" },
    { label: "Dashboard", href: "/dashboard" },
  ],
  Resources: [
    { label: "MUN Guide for Beginners", href: "#" },
    { label: "Resolution Writing Tips", href: "#" },
    { label: "Country Position Papers", href: "#" },
    { label: "Rules of Procedure", href: "#" },
  ],
  Company: [
    { label: "About Us", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Privacy Policy", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Top row */}
        <div className="grid md:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}
              >
                <span className="text-white font-black text-lg italic">M</span>
              </div>
              <span className="text-lg font-bold tracking-tight" style={{ color: "var(--fg)" }}>
                Tidingz
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--fg-muted)" }}>
              The world&apos;s premier platform for Model UN delegates and conference organizers. Empowering the next generation of global leaders.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {["𝕏", "in", "f", "📸"].map((s, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    background: "var(--bg)",
                    border: "1.5px solid var(--border)",
                    color: "var(--fg-muted)",
                  }}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "var(--fg)" }}>
                {section}
              </h4>
              <ul className="space-y-3">
                {links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm transition-colors"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div
          className="rounded-2xl p-6 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}
        >
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>Get conference alerts 📬</p>
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>New conferences and application deadlines, sent weekly.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="input-base flex-1 sm:w-64"
              style={{ padding: "10px 14px", borderRadius: "10px" }}
            />
            <button className="btn btn-primary" style={{ padding: "10px 18px", borderRadius: "10px", whiteSpace: "nowrap" }}>
              Subscribe
            </button>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            © 2026 Tidingz Technologies Inc. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Built with ❤️ for delegates worldwide 🌍
          </p>
        </div>
      </div>
    </footer>
  );
}
