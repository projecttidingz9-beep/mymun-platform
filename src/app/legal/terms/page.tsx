import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Terms & Conditions — Tidingz",
};

const LAST_UPDATED = "June 2, 2026";

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms & Conditions"
      lastUpdated={LAST_UPDATED}
      intro="These Terms govern your access to and use of the Tidingz platform (tidingz.com) operated for Model United Nations delegates, organizers, and institutions. By creating an account or using the service, you agree to these Terms."
      sections={[
        {
          title: "1. Eligibility and accounts",
          paragraphs: [
            "You must be at least 13 years old (or the minimum age required in your jurisdiction) to use Tidingz. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.",
            "You agree to provide accurate registration information and to keep your profile up to date. We may suspend or terminate accounts that violate these Terms or that we reasonably believe pose a security or abuse risk.",
          ],
        },
        {
          title: "2. Roles: delegates and organizers",
          paragraphs: [
            "Delegates may browse the marketplace, register for conferences, manage passes, and use delegate-facing tools subject to each conference's rules.",
            "Organizers may create and manage conferences, review applications, issue passes, and configure pricing and communications. Organizers are solely responsible for conference content, fee collection outside the platform, refunds, and compliance with applicable laws.",
          ],
        },
        {
          title: "3. Conference listings and payments",
          paragraphs: [
            "Tidingz provides software to list conferences and track registrations. Unless we explicitly enable an integrated payment processor, payments between delegates and organizers are handled offline (e.g. bank transfer, UPI) at the organizer's instructions.",
            "Tidingz does not guarantee the quality, safety, or occurrence of any conference. Disputes regarding fees, allotments, or conduct are primarily between delegates and the organizing team.",
          ],
        },
        {
          title: "4. Acceptable use",
          paragraphs: [
            "You may not use Tidingz to harass others, upload malware, scrape the service without permission, impersonate another person, or violate intellectual property or privacy rights.",
            "You may not attempt to bypass security controls, access another user's data without authorization, or interfere with platform availability.",
          ],
        },
        {
          title: "5. Intellectual property",
          paragraphs: [
            "Tidingz retains rights in the platform, branding, and software. You retain rights in content you submit; you grant Tidingz a limited license to host, display, and process that content solely to operate the service.",
          ],
        },
        {
          title: "6. Disclaimers and limitation of liability",
          paragraphs: [
            'The service is provided "as is" without warranties of uninterrupted or error-free operation. To the maximum extent permitted by law, Tidingz is not liable for indirect, incidental, or consequential damages arising from your use of the platform or any conference.',
          ],
        },
        {
          title: "7. Changes and contact",
          paragraphs: [
            "We may update these Terms from time to time. Material changes will be posted on this page with an updated date. Continued use after changes constitutes acceptance.",
            "Questions: support@tidingz.com or via the Contact page on tidingz.com.",
          ],
        },
      ]}
    />
  );
}
