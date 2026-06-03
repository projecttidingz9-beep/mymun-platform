import { jsPDF } from "jspdf";

export type ParticipationCertificateDetails = {
  delegateName: string;
  eventName: string;
  committeeName?: string | null;
  portfolioName?: string | null;
  categoryName?: string | null;
  issuedAt: string;
};

export function downloadParticipationCertificatePdf(details: ParticipationCertificateDetails) {
  const doc = new jsPDF();
  const issuedDate = new Date(details.issuedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setFillColor(18, 24, 35);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(245, 245, 245);
  doc.setFontSize(22);
  doc.text("Certificate of Participation", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.text("Tidingz Model United Nations", 105, 28, { align: "center" });

  let y = 58;
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(12);
  doc.text("This is to certify that", 105, y, { align: "center" });
  y += 14;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(details.delegateName, 105, y, { align: "center" });
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("has participated in", 105, y, { align: "center" });
  y += 12;
  doc.setFontSize(16);
  doc.text(details.eventName, 105, y, { align: "center" });
  y += 14;

  const lines: string[] = [];
  if (details.categoryName) lines.push(`Category: ${details.categoryName}`);
  if (details.committeeName) lines.push(`Committee: ${details.committeeName}`);
  if (details.portfolioName) lines.push(`Portfolio: ${details.portfolioName}`);
  doc.setFontSize(11);
  for (const line of lines) {
    doc.text(line, 105, y, { align: "center" });
    y += 8;
  }

  y += 10;
  doc.setTextColor(100, 110, 121);
  doc.text(`Issued on ${issuedDate}`, 105, y, { align: "center" });
  y += 20;
  doc.setDrawColor(200, 205, 212);
  doc.line(40, y, 170, y);
  doc.setFontSize(10);
  doc.text("Authorized by the organizing committee via Tidingz", 105, y + 8, { align: "center" });

  const safeName = details.delegateName.replace(/[^\w.-]+/g, "_").slice(0, 40);
  doc.save(`certificate-${safeName}-${Date.now()}.pdf`);
}
