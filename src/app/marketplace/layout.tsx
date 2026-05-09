import type { Metadata } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Conference marketplace",
  description:
    "Browse Model United Nations conferences worldwide — filter by level, region, dates, and pricing on Tidingz.",
  alternates: { canonical: `${base}/marketplace` },
  openGraph: {
    title: "Conference marketplace | Tidingz",
    description: "Find and compare MUN conferences in one place.",
    url: `${base}/marketplace`,
    siteName: "Tidingz",
    type: "website",
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
