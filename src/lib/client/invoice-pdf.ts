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

export function downloadRegistrationInvoicePdf(
  registration: Registration,
  user: InvoiceUserDetails
) {
  const doc = new jsPDF();
  const invoiceId = `INV-${registration.id}`;
  const amount = Number(registration.amount || 0).toFixed(2);
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

  let y = 20;
  doc.setFontSize(18);
  doc.text("MyMUN Invoice", 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`Invoice ID: ${invoiceId}`, 14, y);
  y += 7;
  doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, y);
  y += 10;

  doc.text(`Delegate: ${user.name}`, 14, y);
  y += 7;
  doc.text(`Email: ${user.email}`, 14, y);
  y += 7;
  const billingLines = doc.splitTextToSize(`Billing Address: ${billingAddress}`, 180);
  doc.text(billingLines, 14, y);
  y += billingLines.length * 6 + 4;

  doc.text(`Conference: ${registration.conferenceTitle}`, 14, y);
  y += 7;
  doc.text(`Category: ${registration.categoryName}`, 14, y);
  y += 7;
  doc.text(`Registration Date: ${registration.registeredAt}`, 14, y);
  y += 7;
  doc.text(`Payment Status: ${paymentStatus}`, 14, y);
  y += 7;
  doc.text(`Amount: $${amount}`, 14, y);

  doc.save(`invoice-${registration.id}.pdf`);
}
