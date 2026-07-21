import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import OrganizationJsonLd from "@/components/OrganizationJsonLd";
import ThemeController from "@/components/ThemeController";
import CookieConsent from "@/components/CookieConsent";
import { ToastProvider } from "@/components/Toast";
import { getSiteUrl } from "@/lib/site-url";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const siteUrl = getSiteUrl();

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Tidingz — The Future of Model United Nations",
  description:
    "Discover, organize, and participate in Model UN conferences worldwide. Conferences, registration, delegate passes, QR check-in, and organizer dashboards — all in one platform.",
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
        url: "/brand/logo-horizontal-light.png",
        width: 1200,
        height: 315,
        alt: "Tidingz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tidingz — The Future of Model United Nations",
    description: "The world's premier platform for MUN delegates and conference organizers.",
    images: ["/brand/logo-horizontal-light.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen min-h-[100dvh] flex flex-col antialiased overflow-x-clip">
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
