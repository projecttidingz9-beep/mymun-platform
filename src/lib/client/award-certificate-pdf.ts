import { jsPDF } from "jspdf";
import { getAwardPreset, type MunAwardPresetKey } from "@/lib/mun-award-presets";

export type AwardCertificateDetails = {
  delegateName: string;
  eventName: string;
  awardCategory: string;
  presetKey?: string;
  prizeTitle?: string | null;
  committeeName?: string | null;
  issuedAt: string;
};

function ribbonColorForPreset(presetKey?: string): { r: number; g: number; b: number } {
  switch (presetKey as MunAwardPresetKey | undefined) {
    case "best_delegate":
      return { r: 212, g: 175, b: 55 };
    case "outstanding_delegate":
      return { r: 192, g: 192, b: 192 };
    case "high_commendation":
      return { r: 205, g: 127, b: 50 };
    case "best_delegation":
      return { r: 79, g: 70, b: 229 };
    case "best_position_paper":
      return { r: 14, g: 165, b: 233 };
    case "best_chair":
      return { r: 16, g: 185, b: 129 };
    default:
      return { r: 79, g: 70, b: 229 };
  }
}

export function downloadAwardCertificatePdf(details: AwardCertificateDetails) {
  const doc = new jsPDF();
  const preset = details.presetKey ? getAwardPreset(details.presetKey) : undefined;
  const awardTitle = details.prizeTitle?.trim() || preset?.defaultPrizeTitle || details.awardCategory;
  const ribbon = ribbonColorForPreset(details.presetKey);
  const issuedDate = new Date(details.issuedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setFillColor(18, 24, 35);
  doc.rect(0, 0, 210, 48, "F");
  doc.setFillColor(ribbon.r, ribbon.g, ribbon.b);
  doc.rect(0, 48, 210, 6, "F");

  doc.setTextColor(245, 245, 245);
  doc.setFontSize(20);
  doc.text("Certificate of Excellence", 105, 20, { align: "center" });
  doc.setFontSize(10);
  doc.text("Tidingz Model United Nations", 105, 30, { align: "center" });

  let y = 68;
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(12);
  doc.text("Presented to", 105, y, { align: "center" });
  y += 14;
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(details.delegateName, 105, y, { align: "center" });
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("for receiving", 105, y, { align: "center" });
  y += 12;
  doc.setFontSize(18);
  doc.setTextColor(ribbon.r, ribbon.g, ribbon.b);
  doc.text(awardTitle, 105, y, { align: "center" });
  y += 14;
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(12);
  doc.text(`at ${details.eventName}`, 105, y, { align: "center" });
  y += 10;
  if (details.committeeName) {
    doc.setFontSize(11);
    doc.text(`Committee: ${details.committeeName}`, 105, y, { align: "center" });
    y += 8;
  }

  y += 8;
  doc.setTextColor(100, 110, 121);
  doc.setFontSize(10);
  doc.text(`Issued on ${issuedDate}`, 105, y, { align: "center" });
  y += 18;
  doc.setDrawColor(200, 205, 212);
  doc.line(40, y, 170, y);
  doc.text("Authorized by the organizing committee via Tidingz", 105, y + 8, { align: "center" });

  const safeName = details.delegateName.replace(/[^\w.-]+/g, "_").slice(0, 40);
  doc.save(`award-${safeName}-${Date.now()}.pdf`);
}
