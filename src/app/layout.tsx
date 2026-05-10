import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import OrganizationJsonLd from "@/components/OrganizationJsonLd";
import ThemeController from "@/components/ThemeController";
import CookieConsent from "@/components/CookieConsent";
import { ToastProvider } from "@/components/Toast";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Tidingz — The Future of Model United Nations",
  description:
    "Discover, organize, and participate in Model UN conferences worldwide. AI-powered resolution drafting, global marketplace, and seamless delegate management — all in one platform.",
  keywords: ["Model UN", "MUN", "conferences", "delegates", "resolution", "diplomacy"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tidingz — The Future of Model United Nations",
    description: "The world's premier platform for MUN delegates and conference organizers.",
    type: "website",
    url: siteUrl,
    siteName: "Tidingz",
    locale: "en_US",
    images: [
      {
        url: "/tidingz-logo.jpg",
        width: 512,
        height: 512,
        alt: "Tidingz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tidingz — The Future of Model United Nations",
    description: "The world's premier platform for MUN delegates and conference organizers.",
    images: ["/tidingz-logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased">
        <OrganizationJsonLd />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeController />
        <AuthProvider>
          <ToastProvider>
            <div id="main-content" className="flex-1 flex flex-col min-h-0 outline-none" tabIndex={-1}>
              {children}
            </div>
            <CookieConsent />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
