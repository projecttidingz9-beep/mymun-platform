/** Source strings for future localization (Phase 10). */
export const en = {
  brand: "Tidingz",
  navHome: "Home",
  navAbout: "About",
  navContact: "Contact",
  legalPrivacy: "Privacy Policy",
  legalTerms: "Terms & Conditions",
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey): string {
  return en[key];
}
