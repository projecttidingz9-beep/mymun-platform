import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Section = {
  title: string;
  paragraphs: string[];
};

type Props = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: Section[];
};

export default function LegalDocument({ title, lastUpdated, intro, sections }: Props) {
  return (
    <>
      <Navbar />
      <main className="app-shell max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-xs mb-8" style={{ color: "var(--fg-muted)" }}>
          Last updated: {lastUpdated}
        </p>
        <p className="text-sm leading-relaxed mb-10" style={{ color: "var(--fg-muted)" }}>
          {intro}
        </p>
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
              <div className="space-y-3">
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
