/** Stable IDs for idempotent QA mock MUN on production DB — always cleaned up after run. */
export const QA_EVENT_ID = "evt-qa-mock-mun-2026";
export const QA_EVENT_SLUG = "qa-mock-mun-2026";
export const QA_EVENT_TITLE = "[QA-TEST] Tidingz Mock MUN 2026 — DO NOT REGISTER";

export const QA_PASSWORD = "QaMockMun1";
export const QA_EMAIL_DOMAIN = "tidingz-mocktest.invalid";

export const QA_COMMITTEE = {
  UNSC: "cmte-qa-unsc",
  UNHRC: "cmte-qa-unhrc",
  AIPPM: "cmte-qa-aippm",
  PRESS: "cmte-qa-press",
} as const;

export const QA_CATEGORY = {
  DELEGATE: "cat-qa-delegate",
  CHAIR: "cat-qa-chair",
  PRESS: "cat-qa-press",
  DELEGATION: "cat-qa-delegation",
  CLOSED: "cat-qa-closed",
} as const;

export const QA_PORTFOLIO = {
  USA: "pf-qa-usa",
  UK: "pf-qa-uk",
  FRANCE: "pf-qa-france",
} as const;

export type QaPersonaKey =
  | "organizer"
  | "aisha"
  | "rahul"
  | "sofia"
  | "marcus"
  | "priya"
  | "jordan"
  | "popov"
  | "kwame"
  | "naomi"
  | "liam";

export const QA_PERSONAS: Record<
  QaPersonaKey,
  { email: string; name: string; role: "ORGANIZER" | "DELEGATE"; signupViaApi: boolean }
> = {
  organizer: {
    email: `qa.organizer@${QA_EMAIL_DOMAIN}`,
    name: "QA Organizer",
    role: "ORGANIZER",
    signupViaApi: true,
  },
  aisha: {
    email: `qa.delegate.aisha@${QA_EMAIL_DOMAIN}`,
    name: "Aisha Delegate",
    role: "DELEGATE",
    signupViaApi: true,
  },
  rahul: {
    email: `qa.delegate.rahul@${QA_EMAIL_DOMAIN}`,
    name: "Rahul Delegate",
    role: "DELEGATE",
    signupViaApi: true,
  },
  sofia: {
    email: `qa.delegate.sofia@${QA_EMAIL_DOMAIN}`,
    name: "Sofia Delegate",
    role: "DELEGATE",
    signupViaApi: false,
  },
  marcus: {
    email: `qa.delegate.marcus@${QA_EMAIL_DOMAIN}`,
    name: "Marcus Delegation Head",
    role: "DELEGATE",
    signupViaApi: false,
  },
  priya: {
    email: `qa.delegate.priya@${QA_EMAIL_DOMAIN}`,
    name: "Priya Delegate",
    role: "DELEGATE",
    signupViaApi: false,
  },
  jordan: {
    email: `qa.delegate.jordan@${QA_EMAIL_DOMAIN}`,
    name: "Jordan Delegate",
    role: "DELEGATE",
    signupViaApi: false,
  },
  popov: {
    email: `qa.chair.popov@${QA_EMAIL_DOMAIN}`,
    name: "Dr. Popov Chair",
    role: "DELEGATE",
    signupViaApi: false,
  },
  kwame: {
    email: `qa.chair.kwame@${QA_EMAIL_DOMAIN}`,
    name: "Kwame Chair",
    role: "DELEGATE",
    signupViaApi: false,
  },
  naomi: {
    email: `qa.press.naomi@${QA_EMAIL_DOMAIN}`,
    name: "Naomi Press",
    role: "DELEGATE",
    signupViaApi: false,
  },
  liam: {
    email: `qa.edge.liam@${QA_EMAIL_DOMAIN}`,
    name: "Liam Edgecase",
    role: "DELEGATE",
    signupViaApi: false,
  },
};

export const QA_USER_EMAILS = Object.values(QA_PERSONAS).map((p) => p.email);
