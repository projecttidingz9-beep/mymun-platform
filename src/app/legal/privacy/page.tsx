import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy — Tidingz",
};

const LAST_UPDATED = "June 2, 2026";

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro="This Privacy Policy explains how Tidingz collects, uses, and protects personal information when you use our Model UN platform."
      sections={[
        {
          title: "1. Information we collect",
          paragraphs: [
            "Account data: name, email address, role (delegate/organizer), password hash (for email sign-in), and profile fields you choose to provide.",
            "Conference data: registrations, committee preferences, application answers, payment intent status, delegate passes, and check-in records.",
            "Technical data: IP address, browser type, device information, and logs needed for security, rate limiting, and debugging.",
          ],
        },
        {
          title: "2. How we use information",
          paragraphs: [
            "We use your data to operate the service: authenticate you, process registrations, send transactional emails (e.g. password reset, verification, organizer updates), and improve reliability.",
            "We do not sell your personal information. We may use aggregated, de-identified statistics for product analytics.",
          ],
        },
        {
          title: "3. Sharing and processors",
          paragraphs: [
            "We use infrastructure and service providers to host the application and database (e.g. Vercel, Supabase/PostgreSQL), send email (Resend), and monitor errors (Sentry when configured).",
            "Organizers can see delegate information submitted for their conferences. Other users cannot access your private registration details except as required for platform features you use.",
          ],
        },
        {
          title: "4. Retention and security",
          paragraphs: [
            "We retain account and conference records while your account is active and as needed for legal, security, or operational purposes. You may request account deletion subject to organizer and legal obligations.",
            "We apply industry-standard measures including encrypted connections (HTTPS), hashed passwords, and access controls. No method of transmission over the Internet is 100% secure.",
          ],
        },
        {
          title: "5. Your rights",
          paragraphs: [
            "Depending on your location, you may have rights to access, correct, delete, or export your personal data, and to object to certain processing. Contact support@tidingz.com to exercise these rights.",
          ],
        },
        {
          title: "6. International transfers",
          paragraphs: [
            "Your data may be processed in countries where our providers operate. We rely on appropriate safeguards where required by applicable law.",
          ],
        },
        {
          title: "7. Contact",
          paragraphs: [
            "Privacy questions: support@tidingz.com. For EU/UK users, you may also lodge a complaint with your local supervisory authority.",
          ],
        },
      ]}
    />
  );
}
