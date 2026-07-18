import { type OrganizerConference, type RegistrationCategory } from "@/lib/types";

export type RegistrationCategoryType = NonNullable<RegistrationCategory["applicationType"]>;

/** Category types shown in Categories & Pricing (no separate press category — use a press committee instead). */
export const REGISTRATION_CATEGORY_UI_TYPES = [
  "delegate",
  "chair",
  "delegation",
  "organizer",
  "secretariat",
  "other",
] as const satisfies readonly RegistrationCategoryType[];

export type RegistrationCategoryUiType = (typeof REGISTRATION_CATEGORY_UI_TYPES)[number];

/** All supported types including legacy `press` on existing conferences. */
export const REGISTRATION_CATEGORY_TYPES: RegistrationCategoryType[] = [
  ...REGISTRATION_CATEGORY_UI_TYPES,
  "press",
];

export const isSupportedCategoryApplicationType = (
  applicationType?: RegistrationCategory["applicationType"]
): applicationType is RegistrationCategoryType =>
  applicationType === "press" ||
  (REGISTRATION_CATEGORY_UI_TYPES as readonly RegistrationCategoryType[]).includes(
    applicationType as RegistrationCategoryType
  );

export const getCategoryTypeLabel = (applicationType?: RegistrationCategory["applicationType"]) => {
  if (applicationType === "delegation") return "Delegation";
  if (applicationType === "press") return "International Press";
  if (applicationType === "chair") return "Chair";
  if (applicationType === "organizer") return "Organizer Team";
  if (applicationType === "secretariat") return "Secretariat";
  if (applicationType === "other") return "Custom";
  return "Delegate";
};

export const getCategoryRegistrationLabel = (applicationType?: RegistrationCategory["applicationType"]) => {
  if (applicationType === "delegation") return "Delegation Registration";
  if (applicationType === "press") return "Press Registration";
  if (applicationType === "chair") return "Chair Registration";
  if (applicationType === "organizer") return "Organising Committee Registration";
  if (applicationType === "secretariat") return "Secretariat Registration";
  if (applicationType === "other") return "Custom Registration";
  return "Delegate Registration";
};

export const getCategoryTypeHint = (applicationType?: RegistrationCategory["applicationType"]) => {
  if (applicationType === "delegation") return "This category is intended for delegation-level applications.";
  if (applicationType === "press") return "This category is intended for International Press / Press Corps.";
  if (applicationType === "chair") return "This category is intended for executive board and chair applications.";
  if (applicationType === "organizer") return "This category is intended for organizer team applications.";
  if (applicationType === "secretariat") return "This category is intended for secretariat applications.";
  if (applicationType === "other") return "This category uses organizer-defined custom criteria.";
  return "This category is intended for delegate applications.";
};

export const normalizeCategoryApplicationType = (
  applicationType?: RegistrationCategory["applicationType"]
): RegistrationCategoryType => {
  if (isSupportedCategoryApplicationType(applicationType)) {
    return applicationType;
  }
  return "delegate";
};

export const getDefaultCategoryForType = (
  type: RegistrationCategoryType,
  conference: Pick<OrganizerConference, "registrationDeadline">
): RegistrationCategory => {
  const descriptions: Record<RegistrationCategoryType, string> = {
    delegate: "Default delegate category.",
    chair: "Executive board and chair applications.",
    delegation: "Register an entire delegation.",
    organizer: "Internal organising team onboarding category.",
    secretariat: "Secretariat applications.",
    press: "International Press / Press Corps registration.",
    other: "Custom registration category with organizer-defined criteria.",
  };

  const base: RegistrationCategory = {
    id: `cat-${type}-${Date.now()}`,
    name: getCategoryRegistrationLabel(type),
    description: descriptions[type],
    applicationType: type,
    isOpen: true,
    deadlineOverride: conference.registrationDeadline,
    basePrice: type === "organizer" || type === "secretariat" ? 0 : 0,
    requiresCommitteeSelection: type !== "organizer" && type !== "secretariat",
    formFields: [],
    pricingPhases: [],
  };

  if (type === "delegation") {
    return { ...base, maxDelegatesPerDelegation: 10 };
  }
  if (type === "press") {
    return { ...base, requiresCommitteeSelection: true };
  }

  return base;
};
