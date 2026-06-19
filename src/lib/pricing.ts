import {
  CommitteePricingInfo,
  OrganizerCommittee,
  PricingPhase,
  RegistrationCategory,
} from "./types";

const dateToDayNumber = (value: string) => {
  if (!value) return Number.NaN;
  return new Date(value).setHours(0, 0, 0, 0);
};

function isValidDateString(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

export function isPricingPhaseComplete(phase: PricingPhase): boolean {
  const name = phase.name.trim();
  return (
    name.length > 0 &&
    isValidDateString(phase.startDate) &&
    isValidDateString(phase.endDate)
  );
}

export function findIncompletePricingPhases(
  categories: Pick<RegistrationCategory, "pricingPhases">[]
): PricingPhase[] {
  const incomplete: PricingPhase[] = [];
  for (const category of categories) {
    for (const phase of category.pricingPhases || []) {
      if (!isPricingPhaseComplete(phase)) {
        incomplete.push(phase);
      }
    }
  }
  return incomplete;
}

export function formatIncompletePricingPhasesMessage(phases: PricingPhase[]): string {
  if (phases.length === 0) {
    return "Complete every pricing phase (name, start date, end date) or remove empty phases before saving.";
  }
  const names = phases.map((phase) => phase.name.trim() || "Unnamed phase").join(", ");
  return `Complete every pricing phase (name, start date, end date) or remove empty phases before saving. Incomplete: ${names}.`;
}

export function buildDefaultCommitteePrices(
  committees: Pick<OrganizerCommittee, "id" | "name">[],
  defaultPrice: number
): CommitteePricingInfo[] {
  const price = Math.max(0, Number(defaultPrice) || 0);
  return committees.map((committee) => ({
    committeeId: committee.id,
    committeeName: committee.name,
    price,
  }));
}

export function upsertPhaseCommitteePrice(
  phase: PricingPhase,
  committeeId: string,
  committeeName: string,
  price: number
): PricingPhase {
  const normalizedPrice = Math.max(0, Number(price) || 0);
  const existing = phase.committeePrices.find((entry) => entry.committeeId === committeeId);
  if (existing) {
    return {
      ...phase,
      committeePrices: phase.committeePrices.map((entry) =>
        entry.committeeId === committeeId
          ? { ...entry, committeeName, price: normalizedPrice }
          : entry
      ),
    };
  }
  return {
    ...phase,
    committeePrices: [
      ...phase.committeePrices,
      { committeeId, committeeName, price: normalizedPrice },
    ],
  };
}

export function applyPhaseBasePriceToAllCommittees(
  phase: PricingPhase,
  committees: Pick<OrganizerCommittee, "id" | "name">[]
): PricingPhase {
  return {
    ...phase,
    committeePrices: buildDefaultCommitteePrices(committees, phase.basePrice),
  };
}

export function mergeNewCommitteesIntoPhases(
  phases: PricingPhase[],
  committees: Pick<OrganizerCommittee, "id" | "name">[],
  fallbackPrice?: number
): PricingPhase[] {
  return phases.map((phase) => {
    const defaultForPhase = fallbackPrice ?? phase.basePrice;
    let next = phase;
    for (const committee of committees) {
      const hasEntry = next.committeePrices.some((entry) => entry.committeeId === committee.id);
      if (!hasEntry) {
        next = upsertPhaseCommitteePrice(next, committee.id, committee.name, defaultForPhase);
      }
    }
    return next;
  });
}

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
