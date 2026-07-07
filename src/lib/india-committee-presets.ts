export type CommitteeFormatKey =
  | "UN"
  | "NON_UN"
  | "CUSTOM"
  | "AIPPM"
  | "LOK_SABHA"
  | "RAJYA_SABHA"
  | "PRESS_CORPS"
  | "CCC"
  | "CORPORATE_LOBBY"
  | "HISTORICAL"
  | "IP";

export type CommitteePreset = {
  key: CommitteeFormatKey;
  label: string;
  committeeType: "UN" | "NON_UN" | "CUSTOM";
  customTypeLabel?: string;
  memberMode: "UN_COUNTRY" | "CUSTOM_MEMBER";
  members: Array<{ name: string; seatCount: number }>;
  /** When true, organizers set total seats only — no named portfolios (International Press). */
  noPortfolio?: boolean;
  defaultSeatCount?: number;
  metadata?: {
    historicalDate?: string;
    crisisEnabled?: boolean;
    pressBeatRequired?: boolean;
  };
};

const AIPPM_PARTIES = [
  "Bharatiya Janata Party",
  "Indian National Congress",
  "Aam Aadmi Party",
  "Trinamool Congress",
  "Dravida Munnetra Kazhagam",
  "Shiv Sena",
  "Biju Janata Dal",
  "Telugu Desam Party",
  "Communist Party of India (Marxist)",
  "Bahujan Samaj Party",
];

const LOK_SABHA_PARTIES = [
  "BJP — Uttar Pradesh",
  "INC — Maharashtra",
  "AAP — Delhi",
  "TMC — West Bengal",
  "DMK — Tamil Nadu",
  "BJD — Odisha",
  "TDP — Andhra Pradesh",
  "Independent",
];

const RAJYA_SABHA_STATES = [
  "Maharashtra",
  "Uttar Pradesh",
  "West Bengal",
  "Tamil Nadu",
  "Karnataka",
  "Gujarat",
  "Rajasthan",
  "Kerala",
];

const CORPORATE_COMPANIES = [
  "Reliance Industries",
  "Tata Group",
  "Infosys",
  "Adani Group",
  "HDFC Bank",
  "ITC Limited",
];

export const INDIA_COMMITTEE_PRESETS: CommitteePreset[] = [
  {
    key: "AIPPM",
    label: "AIPPM (All India Political Parties Meet)",
    committeeType: "CUSTOM",
    customTypeLabel: "AIPPM",
    memberMode: "CUSTOM_MEMBER",
    members: AIPPM_PARTIES.map((name) => ({ name, seatCount: 1 })),
  },
  {
    key: "LOK_SABHA",
    label: "Lok Sabha",
    committeeType: "CUSTOM",
    customTypeLabel: "Lok Sabha",
    memberMode: "CUSTOM_MEMBER",
    members: LOK_SABHA_PARTIES.map((name) => ({ name, seatCount: 1 })),
  },
  {
    key: "RAJYA_SABHA",
    label: "Rajya Sabha",
    committeeType: "CUSTOM",
    customTypeLabel: "Rajya Sabha",
    memberMode: "CUSTOM_MEMBER",
    members: RAJYA_SABHA_STATES.map((name) => ({ name, seatCount: 2 })),
  },
  {
    key: "PRESS_CORPS",
    label: "Press Corps",
    committeeType: "CUSTOM",
    customTypeLabel: "International Press",
    memberMode: "CUSTOM_MEMBER",
    members: [],
    noPortfolio: true,
    defaultSeatCount: 6,
    metadata: { pressBeatRequired: true },
  },
  {
    key: "IP",
    label: "International Press (IP)",
    committeeType: "CUSTOM",
    customTypeLabel: "International Press",
    memberMode: "CUSTOM_MEMBER",
    members: [],
    noPortfolio: true,
    defaultSeatCount: 6,
    metadata: { pressBeatRequired: true },
  },
  {
    key: "CCC",
    label: "Continuous Crisis Committee (CCC)",
    committeeType: "UN",
    customTypeLabel: "CCC",
    memberMode: "UN_COUNTRY",
    members: [
      "United States of America",
      "United Kingdom",
      "France",
      "China",
      "Russian Federation",
      "India",
      "Brazil",
      "Japan",
    ].map((name) => ({ name, seatCount: 1 })),
    metadata: { crisisEnabled: true },
  },
  {
    key: "CORPORATE_LOBBY",
    label: "Corporate Lobbying",
    committeeType: "NON_UN",
    customTypeLabel: "Corporate Lobbying",
    memberMode: "CUSTOM_MEMBER",
    members: CORPORATE_COMPANIES.map((name) => ({ name, seatCount: 1 })),
  },
  {
    key: "HISTORICAL",
    label: "Historical Committee",
    committeeType: "UN",
    customTypeLabel: "Historical Committee",
    memberMode: "UN_COUNTRY",
    members: [
      "United States of America",
      "Soviet Union",
      "United Kingdom",
      "France",
      "China",
      "India",
    ].map((name) => ({ name, seatCount: 1 })),
    metadata: { historicalDate: "1945" },
  },
];

export function getCommitteePreset(key: CommitteeFormatKey): CommitteePreset | undefined {
  return INDIA_COMMITTEE_PRESETS.find((p) => p.key === key);
}

export function isPressCommitteeFormat(
  committeeFormat?: string,
  customTypeLabel?: string
): boolean {
  if (committeeFormat === "PRESS_CORPS" || committeeFormat === "IP") return true;
  return (customTypeLabel ?? "").trim().toLowerCase().includes("press");
}

export function preferenceLabelForCommittee(committeeType?: string, committeeFormat?: string): string {
  if (committeeFormat === "AIPPM" || committeeFormat === "LOK_SABHA" || committeeFormat === "RAJYA_SABHA") {
    return "Party";
  }
  if (committeeFormat === "PRESS_CORPS" || committeeFormat === "IP") {
    return "Beat";
  }
  if (committeeFormat === "CORPORATE_LOBBY") {
    return "Company";
  }
  if (committeeType === "UN") return "Country";
  return "Member";
}
