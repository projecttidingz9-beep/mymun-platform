import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Refund Policy — Tidingz",
};

const LAST_UPDATED = "June 2, 2026";

export default function RefundPage() {
  return (
    <LegalDocument
      title="Refund Policy"
      lastUpdated={LAST_UPDATED}
      intro="Tidingz is a registration and operations platform. Conference fees are set and collected by individual organizers unless a future integrated payment feature states otherwise."
      sections={[
        {
          title: "1. Platform fees",
          paragraphs: [
            "Tidingz does not charge delegates a separate platform fee unless clearly disclosed at checkout. Any future platform fees will be shown before you confirm payment.",
          ],
        },
        {
          title: "2. Organizer-managed payments",
          paragraphs: [
            "When payment mode is manual, delegates pay organizers directly using instructions on the conference page (bank transfer, UPI, etc.). Tidingz tracks payment intent status for organizer reconciliation but does not hold funds.",
            "Refund eligibility, amounts, and timelines are defined by each conference's published refund rules and by the organizing institution. Contact the conference organizer listed on the event page for refund requests.",
          ],
        },
        {
          title: "3. Registration cancellation",
          paragraphs: [
            "If you cancel a registration before the organizer's deadline, refunds (if any) follow the conference policy. After allotment or pass issuance, refunds may be limited or unavailable.",
          ],
        },
        {
          title: "4. Conference cancellation",
          paragraphs: [
            "If an organizer cancels a conference, they are responsible for communicating refund or credit options to registered delegates. Tidingz will assist with status updates where tools are available but is not the payer of record.",
          ],
        },
        {
          title: "5. Disputes",
          paragraphs: [
            "For payment disputes, contact the organizer first. If you believe a listing is fraudulent or misleading, report it to support@tidingz.com with the conference name and details.",
          ],
        },
      ]}
    />
  );
}
