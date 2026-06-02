import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Cookie Policy — Tidingz",
};

const LAST_UPDATED = "June 2, 2026";

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      lastUpdated={LAST_UPDATED}
      intro="This policy describes how Tidingz uses cookies and similar technologies on tidingz.com."
      sections={[
        {
          title: "1. What are cookies?",
          paragraphs: [
            "Cookies are small text files stored on your device. We use cookies and local storage to keep you signed in, remember preferences, and protect the service.",
          ],
        },
        {
          title: "2. Cookies we use",
          paragraphs: [
            "Essential: mymun_session (HTTP-only authentication cookie), and local storage keys such as tidingz_dark (theme) and tidingz_cookie_consent (your cookie choice).",
            "Functional: preferences you save in the app interface. These are necessary for core features.",
            "Analytics: we do not load third-party analytics cookies by default. If we enable optional analytics in the future, we will request your consent before activating them.",
          ],
        },
        {
          title: "3. Managing cookies",
          paragraphs: [
            "You can use the cookie banner to accept or reject optional categories. Rejecting optional cookies does not block sign-in.",
            "You can clear cookies via your browser settings; you may need to sign in again afterward.",
          ],
        },
        {
          title: "4. Third-party sign-in",
          paragraphs: [
            "If you sign in with Google via Supabase Auth, those providers may set their own cookies during the OAuth flow subject to their policies.",
          ],
        },
        {
          title: "5. Contact",
          paragraphs: ["Questions: support@tidingz.com"],
        },
      ]}
    />
  );
}
