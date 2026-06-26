import type { Metadata } from "next";

import { CONFERENCES_PATH } from "@/lib/paths";
import { getSiteUrl } from "@/lib/site-url";

const base = getSiteUrl();

export const metadata: Metadata = {
  title: "Conferences",
  description:
    "Browse Model United Nations conferences worldwide — filter by level, region, dates, and pricing on Tidingz.",
  alternates: { canonical: `${base}${CONFERENCES_PATH}` },
  openGraph: {
    title: "Conferences | Tidingz",
    description: "Find and compare MUN conferences in one place.",
    url: `${base}${CONFERENCES_PATH}`,
    siteName: "Tidingz",
    type: "website",
  },
};

export default function ConferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
