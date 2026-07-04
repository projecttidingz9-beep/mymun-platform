import { jsPDF } from "jspdf";
import { Registration } from "@/lib/types";

type InvoiceUserDetails = {
  name: string;
  email: string;
  invoiceAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

/** Prefer admin-uploaded conference invoice template when present; otherwise generate a PDF. */
export async function downloadRegistrationInvoice(
  registration: Registration,
  user: InvoiceUserDetails
): Promise<void> {
  if (!registration.paid) {
    throw new Error("Invoice is available after payment is completed.");
  }
  try {
    const res = await fetch(`/api/registrations/${encodeURIComponent(registration.id)}/invoice`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { templateUrl?: string | null };
      if (data.templateUrl) {
        window.open(data.templateUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }
  } catch {
    // Fall through to generated PDF.
  }
  downloadRegistrationInvoicePdf(registration, user);
}

export function downloadRegistrationInvoicePdf(
  registration: Registration,
  user: InvoiceUserDetails
) {
  const doc = new jsPDF();
  const invoiceId = `INV-${registration.id}`;
  const amount = Number(registration.amount || 0).toFixed(2);
  const amountLabel = `₹${amount}`;
  const paymentStatus = registration.paid ? "Paid" : "Pending";
  const addressParts = [
    user.invoiceAddress?.line1,
    user.invoiceAddress?.line2,
    user.invoiceAddress?.city,
    user.invoiceAddress?.state,
    user.invoiceAddress?.postalCode,
    user.invoiceAddress?.country,
  ].filter(Boolean) as string[];
  const billingAddress = addressParts.length > 0 ? addressParts.join(", ") : "Not provided";

  doc.setFillColor(18, 24, 35);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(245, 245, 245);
  doc.setFontSize(18);
  doc.text("Tidingz Invoice", 14, 18);
  doc.setFontSize(10);
  doc.text(`Invoice ID: ${invoiceId}`, 14, 25);

  let y = 42;
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(11);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 14, y);
  y += 10;

  doc.setDrawColor(220, 224, 229);
  doc.roundedRect(14, y, 182, 34, 3, 3, "S");
  doc.setFontSize(10);
  doc.setTextColor(100, 110, 121);
  doc.text("Billed To", 18, y + 7);
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(11);
  doc.text(user.name, 18, y + 14);
  doc.setFontSize(10);
  doc.text(user.email, 18, y + 20);
  const billingLines = doc.splitTextToSize(billingAddress, 86);
  doc.text(billingLines, 18, y + 26);

  doc.setTextColor(100, 110, 121);
  doc.text("Payment Status", 116, y + 7);
  doc.setTextColor(registration.paid ? 22 : 170, registration.paid ? 130 : 60, registration.paid ? 74 : 60);
  doc.setFontSize(12);
  doc.text(paymentStatus, 116, y + 15);
  doc.setTextColor(100, 110, 121);
  doc.setFontSize(10);
  doc.text("Amount Paid", 116, y + 24);
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(12);
  doc.text(amountLabel, 116, y + 31);

  y += 44;
  doc.setDrawColor(220, 224, 229);
  doc.roundedRect(14, y, 182, 54, 3, 3, "S");
  doc.setFontSize(10);
  doc.setTextColor(100, 110, 121);
  doc.text("Description", 18, y + 8);
  doc.text("Category", 92, y + 8);
  doc.text("Registration Date", 132, y + 8);
  doc.text("Total", 176, y + 8);

  doc.setDrawColor(232, 235, 239);
  doc.line(16, y + 11, 194, y + 11);
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(10);
  const conferenceLines = doc.splitTextToSize(registration.conferenceTitle, 66);
  doc.text(conferenceLines, 18, y + 18);
  doc.text(doc.splitTextToSize(registration.categoryName, 36), 92, y + 18);
  doc.text(registration.registeredAt, 132, y + 18);
  doc.text(amountLabel, 176, y + 18);

  y += 62;
  doc.setFontSize(9);
  doc.setTextColor(120, 128, 136);
  doc.text(
    "This is a computer-generated invoice for your conference registration on Tidingz.",
    14,
    y
  );

  doc.save(`invoice-${registration.id}.pdf`);
}
