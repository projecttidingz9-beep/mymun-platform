import { getPhaseStatus } from "@/lib/pricing";
import type { PricingPhase, RegistrationCategory } from "@/lib/types";

export type ConferenceStatusLabel =
  | "Event Ended"
  | "Register Now"
  | "Registrations Closed"
  | "Coming Soon";

export type ConferenceStatusCategory = Pick<
  RegistrationCategory,
  "isOpen" | "pricingPhases" | "registrationDeadline" | "deadlineOverride"
>;

export type ConferenceStatusInput = {
  endDate: string | Date;
  registrationDeadline?: string | Date | null;
  categories?: ConferenceStatusCategory[];
  referenceDate?: Date;
};

export function parseConferenceDay(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function resolveRegistrationDeadlineDay(input: {
  endDate: string | Date;
  registrationDeadline?: string | Date | null;
  categories?: ConferenceStatusCategory[];
}): number | null {
  const openCategories = (input.categories ?? []).filter((category) => category.isOpen !== false);
  const allPhases = openCategories.flatMap((category) => category.pricingPhases || []);

  const explicitDeadlines = [
    input.registrationDeadline,
    ...openCategories.map((category) => category.registrationDeadline || category.deadlineOverride),
    ...allPhases.map((phase: PricingPhase) => phase.endDate),
  ]
    .map(parseConferenceDay)
    .filter((day): day is number => day !== null);

  if (explicitDeadlines.length > 0) {
    return Math.max(...explicitDeadlines);
  }

  return parseConferenceDay(input.endDate);
}

export function resolveConferenceStatusBadge(input: ConferenceStatusInput): ConferenceStatusLabel {
  const today = parseConferenceDay(input.referenceDate ?? new Date());
  if (today === null) return "Coming Soon";

  const eventEnd = parseConferenceDay(input.endDate);
  if (eventEnd !== null && eventEnd < today) return "Event Ended";

  const openCategories = (input.categories ?? []).filter((category) => category.isOpen !== false);
  if (openCategories.length === 0) return "Registrations Closed";

  const registrationDeadlineDay = resolveRegistrationDeadlineDay({
    endDate: input.endDate,
    registrationDeadline: input.registrationDeadline,
    categories: openCategories,
  });

  if (registrationDeadlineDay !== null && registrationDeadlineDay < today) {
    return "Registrations Closed";
  }

  const allPhases = openCategories.flatMap((category) => category.pricingPhases || []);
  const hasActivePhase = allPhases.some(
    (phase) => getPhaseStatus(phase, input.referenceDate) === "Active"
  );
  if (hasActivePhase) return "Register Now";

  if (allPhases.length > 0) {
    const hasUpcomingPhase = allPhases.some(
      (phase) => getPhaseStatus(phase, input.referenceDate) === "Upcoming"
    );
    if (hasUpcomingPhase) return "Coming Soon";
    return "Registrations Closed";
  }

  if (registrationDeadlineDay !== null && registrationDeadlineDay >= today) {
    return "Register Now";
  }

  return "Registrations Closed";
}

export function isConferenceRegistrationOpen(input: ConferenceStatusInput): boolean {
  return resolveConferenceStatusBadge(input) === "Register Now";
}
