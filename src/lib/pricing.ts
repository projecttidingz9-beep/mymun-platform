import { OrganizerCommittee, PricingPhase, RegistrationCategory } from "./types";

const dateToDayNumber = (value: string) => {
  if (!value) return Number.NaN;
  return new Date(value).setHours(0, 0, 0, 0);
};

export function getActivePhase(phases: PricingPhase[], referenceDate = new Date()): PricingPhase | null {
  const current = new Date(referenceDate).setHours(0, 0, 0, 0);
  const sorted = [...phases].sort(
    (a, b) => dateToDayNumber(a.startDate) - dateToDayNumber(b.startDate)
  );

  for (const phase of sorted) {
    const start = dateToDayNumber(phase.startDate);
    const end = dateToDayNumber(phase.endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (current >= start && current <= end) {
      return phase;
    }
  }

  return null;
}

export type PricingPhaseStatus = "Upcoming" | "Active" | "Ended";

export function getPhaseStatus(phase: PricingPhase, referenceDate = new Date()): PricingPhaseStatus {
  const current = new Date(referenceDate).setHours(0, 0, 0, 0);
  const start = dateToDayNumber(phase.startDate);
  const end = dateToDayNumber(phase.endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return "Ended";
  if (current < start) return "Upcoming";
  if (current > end) return "Ended";
  return "Active";
}

export function resolveRegistrationPrice(
  category: RegistrationCategory,
  selectedCommitteeId?: string,
  referenceDate = new Date()
) {
  const activePhase = getActivePhase(category.pricingPhases, referenceDate);
  const sortedByEnd = [...category.pricingPhases].sort(
    (a, b) => dateToDayNumber(b.endDate) - dateToDayNumber(a.endDate)
  );
  const latestEndedPhase = sortedByEnd.find((phase) => getPhaseStatus(phase, referenceDate) === "Ended");

  if (!activePhase && !latestEndedPhase) {
    return {
      amount: category.basePrice,
      phaseId: undefined,
      phaseName: undefined,
      source: "category-base" as const,
      status: "base" as const,
    };
  }

  const resolvedPhase = activePhase || latestEndedPhase!;

  if (selectedCommitteeId) {
    const committeePrice = resolvedPhase.committeePrices.find(
      (override) => override.committeeId === selectedCommitteeId
    );

    if (committeePrice) {
      return {
        amount: committeePrice.price,
        phaseId: resolvedPhase.id,
        phaseName: resolvedPhase.name,
        source: "phase-committee-override" as const,
        status: activePhase ? ("active-phase" as const) : ("ended-phase" as const),
      };
    }
  }

  return {
    amount: resolvedPhase.basePrice,
    phaseId: resolvedPhase.id,
    phaseName: resolvedPhase.name,
    source: "phase-base" as const,
    status: activePhase ? ("active-phase" as const) : ("ended-phase" as const),
  };
}

export function getCategoryStartingPrice(
  category: RegistrationCategory,
  committees: OrganizerCommittee[],
  referenceDate = new Date()
) {
  const phase = getActivePhase(category.pricingPhases, referenceDate);
  if (!phase) return category.basePrice;

  const prices = [phase.basePrice];
  for (const committee of committees) {
    const override = phase.committeePrices.find((entry) => entry.committeeId === committee.id);
    if (override) prices.push(override.price);
  }
  return Math.min(...prices);
}

export function hasOverlappingPhases(phases: PricingPhase[]) {
  const sorted = [...phases].sort(
    (a, b) => dateToDayNumber(a.startDate) - dateToDayNumber(b.startDate)
  );

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const previousEnd = dateToDayNumber(previous.endDate);
    const currentStart = dateToDayNumber(current.startDate);
    if (!Number.isNaN(previousEnd) && !Number.isNaN(currentStart) && currentStart <= previousEnd) {
      return true;
    }
  }

  return false;
}
