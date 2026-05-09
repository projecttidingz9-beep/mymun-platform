import { prisma } from "./prisma";

const dayStart = (d: Date) => new Date(d).setHours(0, 0, 0, 0);

type PhaseRow = { id: string; name: string; startDate: Date; endDate: Date; basePrice: number; committeePriceJson: string | null };

function getActivePhaseRow(phases: PhaseRow[], reference: Date): PhaseRow | null {
  const current = dayStart(reference);
  const sorted = [...phases].sort((a, b) => dayStart(a.startDate) - dayStart(b.startDate));
  for (const phase of sorted) {
    const start = dayStart(phase.startDate);
    const end = dayStart(phase.endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (current >= start && current <= end) return phase;
  }
  const sortedByEnd = [...phases].sort((a, b) => dayStart(b.endDate) - dayStart(a.endDate));
  return sortedByEnd.find((phase) => dayStart(reference) > dayStart(phase.endDate)) ?? null;
}

export async function resolveServerRegistrationAmount(params: {
  eventId: string;
  committeeConfigId?: string | null;
  referenceDate?: Date;
}): Promise<{ amount: number; currency: string; phaseId?: string; phaseName?: string }> {
  const ref = params.referenceDate ?? new Date();
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      currency: true,
      organizerConfig: {
        select: {
          pricingPhases: true,
          committees: {
            select: { id: true, basePrice: true },
          },
        },
      },
    },
  });

  const currency = event?.currency?.trim() || "INR";

  if (!event?.organizerConfig) {
    return { amount: 0, currency };
  }

  const phases = event.organizerConfig.pricingPhases;
  const active = phases.length ? getActivePhaseRow(phases, ref) : null;

  if (!active) {
    return { amount: 0, currency };
  }

  const committeeId = params.committeeConfigId?.trim();
  if (committeeId) {
    const committee = event.organizerConfig.committees.find((c) => c.id === committeeId);
    if (committee?.basePrice != null) {
      return {
        amount: committee.basePrice,
        currency,
        phaseId: active.id,
        phaseName: active.name,
      };
    }
    if (active.committeePriceJson) {
      try {
        const map = JSON.parse(active.committeePriceJson) as Record<string, number>;
        const v = map[committeeId];
        if (typeof v === "number" && Number.isFinite(v)) {
          return {
            amount: v,
            currency,
            phaseId: active.id,
            phaseName: active.name,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    amount: active.basePrice,
    currency,
    phaseId: active.id,
    phaseName: active.name,
  };
}
