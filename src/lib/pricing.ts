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

export function resolveRegistrationPrice(
  category: RegistrationCategory,
  selectedCommitteeId?: string,
  referenceDate = new Date()
) {
  const activePhase = getActivePhase(category.pricingPhases, referenceDate);

  if (!activePhase) {
    return {
      amount: category.basePrice,
      phaseId: undefined,
      phaseName: undefined,
      source: "category-base" as const,
    };
  }

  if (selectedCommitteeId) {
    const committeePrice = activePhase.committeePrices.find(
      (override) => override.committeeId === selectedCommitteeId
    );

    if (committeePrice) {
      return {
        amount: committeePrice.price,
        phaseId: activePhase.id,
        phaseName: activePhase.name,
        source: "phase-committee-override" as const,
      };
    }
  }

  return {
    amount: activePhase.basePrice,
    phaseId: activePhase.id,
    phaseName: activePhase.name,
    source: "phase-base" as const,
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
