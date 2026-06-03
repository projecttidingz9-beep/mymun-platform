import { prisma } from "@/lib/server/prisma";
import {
  loadRegistrationCategoryForValidation,
  RegistrationPricingError,
  resolveServerRegistrationAmount,
} from "@/lib/server/resolve-registration-price";

export class RegistrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationValidationError";
  }
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function validateRegistrationRequest(body: Record<string, unknown>) {
  const eventId = String(body.eventId || "").trim();
  const categoryId = String(body.categoryId || "").trim();
  const categoryName = String(body.categoryName || "").trim();
  const committeeConfigId =
    typeof body.committeeConfigId === "string" && body.committeeConfigId.trim()
      ? body.committeeConfigId.trim()
      : undefined;

  if (!eventId || !categoryName) {
    throw new RegistrationValidationError("eventId and categoryName are required.");
  }

  const fullName =
    typeof body.fullName === "string"
      ? body.fullName.trim()
      : typeof (body.formAnswers as Record<string, unknown> | undefined)?.fullName === "string"
        ? String((body.formAnswers as Record<string, unknown>).fullName).trim()
        : "";
  const school =
    typeof body.school === "string"
      ? body.school.trim()
      : typeof (body.formAnswers as Record<string, unknown> | undefined)?.school === "string"
        ? String((body.formAnswers as Record<string, unknown>).school).trim()
        : "";

  if (!fullName) {
    throw new RegistrationValidationError("Full name is required.");
  }
  if (!school) {
    throw new RegistrationValidationError("School/institution is required.");
  }

  const committeePreferences = dedupeStrings(
    Array.isArray(body.committeePreferences)
      ? body.committeePreferences.map(String)
      : []
  );

  if (categoryId) {
    const category = await loadRegistrationCategoryForValidation(eventId, categoryId);
    if (!category) {
      throw new RegistrationValidationError("Registration category not found for this conference.");
    }
    if (!category.isOpen) {
      throw new RegistrationValidationError("This registration category is closed.");
    }
    if (category.registrationDeadline && new Date() > category.registrationDeadline) {
      throw new RegistrationValidationError("Registration deadline has passed for this category.");
    }
    if (category.requiresCommitteeSelection && committeePreferences.length === 0 && !committeeConfigId) {
      throw new RegistrationValidationError("Committee preference is required for this category.");
    }
  }

  if (committeeConfigId || committeePreferences.length > 0) {
    const committeeIds = committeeConfigId
      ? dedupeStrings([committeeConfigId, ...committeePreferences])
      : committeePreferences;

    const committees = await prisma.committeeConfig.findMany({
      where: {
        id: { in: committeeIds },
        organizerConfig: { eventId },
      },
      select: { id: true },
    });

    const found = new Set(committees.map((c) => c.id));
    for (const id of committeeIds) {
      if (!found.has(id)) {
        throw new RegistrationValidationError("One or more committee preferences are invalid for this conference.");
      }
    }
  }

  let pricing;
  try {
    pricing = await resolveServerRegistrationAmount({
      eventId,
      categoryId: categoryId || undefined,
      committeeConfigId,
    });
  } catch (error) {
    if (error instanceof RegistrationPricingError) {
      throw new RegistrationValidationError(error.message);
    }
    throw error;
  }

  if (pricing.amount > 0 && !categoryId) {
    throw new RegistrationValidationError("categoryId is required for paid registrations.");
  }

  return {
    eventId,
    categoryId: categoryId || undefined,
    categoryName,
    committeeConfigId,
    committeePreferences,
    pricing,
    fullName,
    school,
  };
}

export function serializeRegistrationPreferences(body: Record<string, unknown>) {
  const committeePreferences = Array.isArray(body.committeePreferences)
    ? body.committeePreferences.map(String)
    : [];
  const portfolioPreferencesByCommittee =
    body.portfolioPreferencesByCommittee &&
    typeof body.portfolioPreferencesByCommittee === "object"
      ? body.portfolioPreferencesByCommittee
      : {};
  const formAnswers =
    body.formAnswers && typeof body.formAnswers === "object"
      ? (body.formAnswers as Record<string, unknown>)
      : {};

  return {
    committeePreferencesJson: committeePreferences.length
      ? JSON.stringify(committeePreferences)
      : null,
    portfolioPreferencesJson: Object.keys(portfolioPreferencesByCommittee).length
      ? JSON.stringify(portfolioPreferencesByCommittee)
      : null,
    formAnswersJson: Object.keys(formAnswers).length ? JSON.stringify(formAnswers) : null,
  };
}
