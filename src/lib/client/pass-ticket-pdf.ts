import { jsPDF } from "jspdf";
import type { RegistrationCategory } from "@/lib/types";

export type PassTicketInput = {
  eventName: string;
  delegateName: string;
  categoryName: string;
  applicationType?: RegistrationCategory["applicationType"];
  committeeName?: string;
  portfolioName?: string;
  registrationId: string;
  passId: string;
  issuedAt: string;
  qrImageDataUrl: string;
};

function passTypeLabel(applicationType?: string): string {
  switch (applicationType) {
    case "press":
      return "PRESS PASS";
    case "chair":
      return "CHAIR PASS";
    case "delegation":
      return "DELEGATION PASS";
    case "organizer":
      return "ORGANIZER PASS";
    case "other":
      return "EVENT PASS";
    default:
      return "DELEGATE PASS";
  }
}

function holderLabel(applicationType?: string): string {
  switch (applicationType) {
    case "press":
      return "PRESS";
    case "chair":
      return "CHAIR";
    case "delegation":
      return "DELEGATION HEAD";
    case "organizer":
      return "ORGANIZER";
    default:
      return "DELEGATE";
  }
}

function officialPassSubtitle(applicationType?: string): string {
  return `OFFICIAL ${passTypeLabel(applicationType)}`;
}

function isDelegatePass(applicationType?: string): boolean {
  return !applicationType || applicationType === "delegate";
}

type Rgb = { r: number; g: number; b: number };

type TicketBounds = {
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  headerH: number;
  bodyTop: number;
  radius: number;
};

const PAGE_BG_TOP: Rgb = { r: 11, g: 13, b: 18 };
const PAGE_BG_BOTTOM: Rgb = { r: 26, g: 16, b: 64 };
const HEADER_START: Rgb = { r: 18, g: 24, b: 42 };
const HEADER_MID: Rgb = { r: 49, g: 46, b: 129 };
const HEADER_END: Rgb = { r: 79, g: 70, b: 229 };
const ACCENT = { r: 79, g: 70, b: 229 };
const ACCENT_LIGHT: Rgb = { r: 147, g: 197, b: 253 };
const LABEL: Rgb = { r: 107, g: 114, b: 128 };
const VALUE: Rgb = { r: 17, g: 24, b: 39 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BODY_PANEL: Rgb = { r: 248, g: 250, b: 252 };
const STUB_BG: Rgb = { r: 241, g: 245, b: 249 };
const CARD_BORDER: Rgb = { r: 229, g: 231, b: 235 };
function setRgb(doc: jsPDF, color: Rgb) {
  doc.setTextColor(color.r, color.g, color.b);
}

function setFillRgb(doc: jsPDF, color: Rgb) {
  doc.setFillColor(color.r, color.g, color.b);
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: lerp(from.r, to.r, t),
    g: lerp(from.g, to.g, t),
    b: lerp(from.b, to.b, t),
  };
}

function spacedLabel(label: string): string {
  return label.toUpperCase().split("").join(" ");
}

async function loadBrandIconDataUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/brand/logo-icon-dark.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawPageBackdrop(doc: jsPDF, pageW: number, pageH: number) {
  const bands = 12;
  const bandH = pageH / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const c = lerpRgb(PAGE_BG_TOP, PAGE_BG_BOTTOM, t);
    setFillRgb(doc, c);
    doc.rect(0, i * bandH, pageW, bandH + 0.5, "F");
  }

  setFillRgb(doc, { r: 55, g: 48, b: 120 });
  doc.circle(pageW - 18, 42, 48, "F");
  doc.circle(22, pageH - 38, 56, "F");
}

function drawWatermark(doc: jsPDF, bounds: TicketBounds) {
  const cx = bounds.cardX + bounds.cardW / 2;
  const cy = bounds.bodyTop + (bounds.cardH - (bounds.bodyTop - bounds.cardY)) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  setRgb(doc, { r: 226, g: 232, b: 240 });
  doc.text("TIDINGZ", cx, cy, { align: "center", angle: 28 });
}

function drawTicketCard(doc: jsPDF, bounds: TicketBounds) {
  const { cardX, cardY, cardW, cardH, radius, headerH, bodyTop } = bounds;

  setFillRgb(doc, { r: 67, g: 56, b: 180 });
  doc.roundedRect(cardX - 0.6, cardY - 0.6, cardW + 1.2, cardH + 1.2, radius + 0.5, radius + 0.5, "F");

  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setDrawColor(CARD_BORDER.r, CARD_BORDER.g, CARD_BORDER.b);
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, cardY, cardW, cardH, radius, radius, "FD");

  setFillRgb(doc, BODY_PANEL);
  doc.rect(cardX + 0.5, bodyTop, cardW - 1, cardH - (bodyTop - cardY) - 0.5, "F");
}

function drawHeaderGradient(doc: jsPDF, bounds: TicketBounds) {
  const { cardX, cardY, cardW, headerH, radius } = bounds;
  const strips = 24;
  const stripW = cardW / strips;

  for (let i = 0; i < strips; i++) {
    const t = i / (strips - 1);
    const color =
      t < 0.5
        ? lerpRgb(HEADER_START, HEADER_MID, t * 2)
        : lerpRgb(HEADER_MID, HEADER_END, (t - 0.5) * 2);
    setFillRgb(doc, color);
    doc.rect(cardX + i * stripW, cardY, stripW + 0.5, headerH, "F");
  }

  doc.roundedRect(cardX, cardY, cardW, headerH, radius, radius, "F");
  doc.rect(cardX, cardY + headerH - radius, cardW, radius, "F");

  setFillRgb(doc, ACCENT_LIGHT);
  doc.rect(cardX + 8, cardY + headerH, cardW - 16, 0.8, "F");
}

function drawHeader(
  doc: jsPDF,
  pass: PassTicketInput,
  bounds: TicketBounds,
  logoDataUrl: string | null
) {
  const { cardX, cardY, cardW, headerH } = bounds;
  drawHeaderGradient(doc, bounds);

  const logoSize = 14;
  const textX = cardX + 10 + (logoDataUrl ? logoSize + 4 : 0);

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", cardX + 10, cardY + 9, logoSize, logoSize);
    } catch {
      /* skip broken logo */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  setRgb(doc, WHITE);
  doc.text("TIDINGZ", textX, cardY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(officialPassSubtitle(pass.applicationType), cardX + cardW - 10, cardY + 11, {
    align: "right",
  });

  const pillText = pass.categoryName.trim() || "Delegate";
  doc.setFontSize(7.5);
  const pillW = Math.min(doc.getTextWidth(pillText) + 12, 72);
  const pillX = cardX + cardW - 10 - pillW;
  const pillY = cardY + 20;

  setFillRgb(doc, { r: 55, g: 48, b: 100 });
  doc.roundedRect(pillX + 0.4, pillY + 0.4, pillW, 8, 4, 4, "F");
  setFillRgb(doc, ACCENT);
  doc.setDrawColor(ACCENT_LIGHT.r, ACCENT_LIGHT.g, ACCENT_LIGHT.b);
  doc.setLineWidth(0.2);
  doc.roundedRect(pillX, pillY, pillW, 8, 4, 4, "FD");
  setRgb(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.text(pillText, pillX + pillW / 2, pillY + 5.5, { align: "center" });
}

function drawSection(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  valueSize = 11,
  drawRule = true
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  setRgb(doc, LABEL);
  doc.text(spacedLabel(label), x, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(valueSize);
  setRgb(doc, VALUE);
  const lines = doc.splitTextToSize(value, maxWidth);
  doc.text(lines, x, y + 5.5);

  const nextY = y + 5.5 + lines.length * 5.2 + 5;
  if (drawRule) {
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.15);
    doc.line(x, nextY - 2, x + maxWidth, nextY - 2);
  }
  return nextY + 2;
}

function drawQrFrame(
  doc: jsPDF,
  docPass: PassTicketInput,
  qrX: number,
  qrY: number,
  qrBox: number,
  qrSize: number,
  qrPad: number
) {
  const outerPad = 4;
  setFillRgb(doc, { r: 224, g: 231, b: 255 });
  doc.roundedRect(qrX - outerPad, qrY - outerPad, qrBox + outerPad * 2, qrBox + outerPad * 2, 3, 3, "F");

  setFillRgb(doc, ACCENT);
  doc.roundedRect(qrX - 1.5, qrY - 1.5, qrBox + 3, qrBox + 3, 2.5, 2.5, "F");

  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setDrawColor(CARD_BORDER.r, CARD_BORDER.g, CARD_BORDER.b);
  doc.setLineWidth(0.25);
  doc.roundedRect(qrX, qrY, qrBox, qrBox, 2, 2, "FD");

  const tick = 3;
  doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.setLineWidth(0.35);
  doc.line(qrX - 1.5, qrY + 2, qrX - 1.5 + tick, qrY + 2);
  doc.line(qrX - 1.5, qrY + 2, qrX - 1.5, qrY + 2 + tick);
  doc.line(qrX + qrBox + 1.5 - tick, qrY + 2, qrX + qrBox + 1.5, qrY + 2);
  doc.line(qrX + qrBox + 1.5, qrY + 2, qrX + qrBox + 1.5, qrY + 2 + tick);
  doc.line(qrX - 1.5, qrY + qrBox - 2 - tick, qrX - 1.5 + tick, qrY + qrBox - 2);
  doc.line(qrX - 1.5, qrY + qrBox - 2, qrX - 1.5, qrY + qrBox - 2 - tick);
  doc.line(qrX + qrBox + 1.5 - tick, qrY + qrBox - 2, qrX + qrBox + 1.5, qrY + qrBox - 2);
  doc.line(qrX + qrBox + 1.5, qrY + qrBox - 2 - tick, qrX + qrBox + 1.5, qrY + qrBox - 2);

  doc.addImage(docPass.qrImageDataUrl, "PNG", qrX + qrPad, qrY + qrPad, qrSize, qrSize);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  setRgb(doc, LABEL);
  doc.text("Scan at gate", qrX + qrBox / 2, qrY + qrBox + 7, { align: "center" });
}

function drawDetailsAndQr(doc: jsPDF, pass: PassTicketInput, bounds: TicketBounds) {
  const { cardX, cardY, cardW, bodyTop } = bounds;
  const leftX = cardX + 14;
  const leftW = cardW - 14 - 88;
  let y = bodyTop + 8;

  const committeeName = pass.committeeName?.trim() || "";
  const portfolioName = pass.portfolioName?.trim() || "";
  const applicationType = pass.applicationType;

  y = drawSection(doc, "EVENT", pass.eventName, leftX, y, leftW, 13, true);
  y = drawSection(doc, holderLabel(applicationType), pass.delegateName, leftX, y, leftW, 11, true);

  if (isDelegatePass(applicationType)) {
    y = drawSection(
      doc,
      "COMMITTEE",
      committeeName || "Pending assignment",
      leftX,
      y,
      leftW,
      11,
      true
    );
    drawSection(doc, "PORTFOLIO", portfolioName || "—", leftX, y, leftW, 11, false);
  } else if (applicationType === "press") {
    y = drawSection(
      doc,
      "BEAT",
      portfolioName || committeeName || "International Press",
      leftX,
      y,
      leftW,
      11,
      true
    );
  } else if (applicationType === "chair") {
    if (committeeName) {
      drawSection(doc, "COMMITTEE", committeeName, leftX, y, leftW, 11, false);
    }
  } else {
    if (committeeName) {
      y = drawSection(doc, "COMMITTEE", committeeName, leftX, y, leftW, 11, true);
    }
    if (portfolioName) {
      drawSection(doc, "PORTFOLIO", portfolioName, leftX, y, leftW, 11, false);
    }
  }

  const qrSize = 52;
  const qrPad = 3;
  const qrBox = qrSize + qrPad * 2;
  const qrX = cardX + cardW - 14 - qrBox - 4;
  const qrY = bodyTop + 10;
  drawQrFrame(doc, pass, qrX, qrY, qrBox, qrSize, qrPad);
}

function drawPerforation(doc: jsPDF, tearY: number, cardX: number, cardW: number) {
  const notchR = 3;
  const leftCx = cardX;
  const rightCx = cardX + cardW;
  const gapStart = cardX + 12;
  const gapEnd = cardX + cardW - 12;

  setFillRgb(doc, BODY_PANEL);
  doc.circle(leftCx, tearY, notchR, "F");
  setFillRgb(doc, PAGE_BG_BOTTOM);
  doc.circle(leftCx - notchR * 0.15, tearY, notchR + 0.3, "F");

  setFillRgb(doc, BODY_PANEL);
  doc.circle(rightCx, tearY, notchR, "F");
  setFillRgb(doc, PAGE_BG_BOTTOM);
  doc.circle(rightCx + notchR * 0.15, tearY, notchR + 0.3, "F");

  doc.setDrawColor(180, 186, 198);
  doc.setLineWidth(0.2);
  const dash = 2.5;
  const gap = 2;
  let x = gapStart;
  while (x < gapEnd) {
    const end = Math.min(x + dash, gapEnd);
    doc.line(x, tearY, end, tearY);
    x += dash + gap;
  }
}

function formatIssuedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncateId(id: string, max = 24): string {
  if (id.length <= max) return id;
  return `${id.slice(0, 12)}…${id.slice(-10)}`;
}

function drawStubAndFooter(doc: jsPDF, pass: PassTicketInput, bounds: TicketBounds) {
  const { cardX, cardY, cardW, cardH } = bounds;
  const tearY = cardY + cardH - 58;
  drawPerforation(doc, tearY, cardX, cardW);

  const stubY = tearY + 6;
  const committeeStub = isDelegatePass(pass.applicationType) && Boolean(pass.committeeName?.trim());
  const stubHeight = committeeStub ? 28 : 22;
  setFillRgb(doc, STUB_BG);
  doc.roundedRect(cardX + 8, stubY, cardW - 16, stubHeight, 2, 2, "F");

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  setRgb(doc, { r: 71, g: 85, b: 105 });
  doc.text(
    `REG  ${truncateId(pass.registrationId, 28)}`,
    cardX + 12,
    stubY + 8
  );
  doc.text(`PASS ${truncateId(pass.passId, 28)}`, cardX + 12, stubY + 14);
  if (committeeStub) {
    doc.text(`COMMITTEE  ${pass.committeeName!.trim()}`, cardX + 12, stubY + 20);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setRgb(doc, VALUE);
  const issuedY = committeeStub ? stubY + 16 : stubY + 11;
  doc.text(`ISSUED  ${formatIssuedAt(pass.issuedAt)}`, cardX + cardW - 12, issuedY, {
    align: "right",
  });

  const barY = cardY + cardH - 24;
  const barW = cardW - 20;
  const barX = cardX + 10;
  const segments = 16;
  const segW = barW / segments;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    setFillRgb(doc, lerpRgb(ACCENT, ACCENT_LIGHT, t));
    doc.rect(barX + i * segW, barY, segW + 0.5, 3.5, "F");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setRgb(doc, VALUE);
  doc.text("Present this pass at the event gate.", cardX + 12, barY + 10);
  doc.setFontSize(7);
  setRgb(doc, LABEL);
  doc.text("This pass is for one-time use only.", cardX + 12, barY + 15);
}

function drawPageFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  applicationType?: string
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setRgb(doc, { r: 148, g: 163, b: 184 });
  const footerLabel = passTypeLabel(applicationType)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  doc.text(`tidingz.com  ·  Official ${footerLabel}`, pageW / 2, pageH - 11, {
    align: "center",
  });
}

export async function downloadPassTicketPdf(pass: PassTicketInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;

  const cardW = pageW - 32;
  const cardH = 210;
  const cardX = 16;
  const cardY = 36;
  const headerH = 40;
  const radius = 5;
  const bodyTop = cardY + headerH;

  const bounds: TicketBounds = {
    cardX,
    cardY,
    cardW,
    cardH,
    headerH,
    bodyTop,
    radius,
  };

  const logoDataUrl = await loadBrandIconDataUrl();

  drawPageBackdrop(doc, pageW, pageH);
  drawTicketCard(doc, bounds);
  drawWatermark(doc, bounds);
  drawHeader(doc, pass, bounds, logoDataUrl);
  drawDetailsAndQr(doc, pass, bounds);
  drawStubAndFooter(doc, pass, bounds);
  drawPageFooter(doc, pageW, pageH, pass.applicationType);

  doc.save(`event-pass-${pass.registrationId}.pdf`);
}
