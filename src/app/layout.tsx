import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import ThemeController from "@/components/ThemeController";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tidingz — The Future of Model United Nations",
  description: "Discover, organize, and participate in Model UN conferences worldwide. AI-powered resolution drafting, global marketplace, and seamless delegate management — all in one platform.",
  keywords: ["Model UN", "MUN", "conferences", "delegates", "resolution", "diplomacy"],
  openGraph: {
    title: "Tidingz — The Future of Model United Nations",
    description: "The world's premier platform for MUN delegates and conference organizers.",
    type: "website",
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
        <ThemeController />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
