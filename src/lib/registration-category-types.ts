import { type OrganizerConference, type RegistrationCategory } from "@/lib/types";

export type RegistrationCategoryType = NonNullable<RegistrationCategory["applicationType"]>;

export const REGISTRATION_CATEGORY_TYPES: RegistrationCategoryType[] = [
  "delegate",
  "chair",
  "delegation",
  "organizer",
  "other",
];

export const getCategoryTypeLabel = (applicationType?: RegistrationCategory["applicationType"]) => {
  if (applicationType === "delegation") return "Delegation";
  if (applicationType === "chair") return "Chair";
  if (applicationType === "organizer") return "Organizer Team";
  if (applicationType === "other") return "Custom";
  return "Delegate";
};

export const getCategoryRegistrationLabel = (applicationType?: RegistrationCategory["applicationType"]) => {
  if (applicationType === "delegation") return "Delegation Registration";
  if (applicationType === "chair") return "Chair Registration";
  if (applicationType === "organizer") return "Organising Committee Registration";
  if (applicationType === "other") return "Custom Registration";
  return "Delegate Registration";
};

export const getCategoryTypeHint = (applicationType?: RegistrationCategory["applicationType"]) => {
  if (applicationType === "delegation") return "This category is intended for delegation-level applications.";
  if (applicationType === "chair") return "This category is intended for executive board and chair applications.";
  if (applicationType === "organizer") return "This category is intended for organizer team applications.";
  if (applicationType === "other") return "This category uses organizer-defined custom criteria.";
  return "This category is intended for delegate applications.";
};

export const normalizeCategoryApplicationType = (
  applicationType?: RegistrationCategory["applicationType"]
): RegistrationCategoryType => {
  if (applicationType && REGISTRATION_CATEGORY_TYPES.includes(applicationType)) {
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
    other: "Custom registration category with organizer-defined criteria.",
  };

  const base: RegistrationCategory = {
    id: `cat-${type}`,
    name: getCategoryRegistrationLabel(type),
    description: descriptions[type],
    applicationType: type,
    isOpen: true,
    deadlineOverride: conference.registrationDeadline,
    basePrice: type === "organizer" ? 0 : 0,
    requiresCommitteeSelection: type !== "organizer",
    formFields: [],
    pricingPhases: [],
  };

  if (type === "delegation") {
    return { ...base, maxDelegatesPerDelegation: 10 };
  }

  return base;
};
