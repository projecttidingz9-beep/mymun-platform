import { describe, expect, it } from "vitest";
import {
  applyPhaseBasePriceToAllCommittees,
  buildDefaultCommitteePrices,
  findIncompletePricingPhases,
  formatIncompletePricingPhasesMessage,
  isPricingPhaseComplete,
  mergeNewCommitteesIntoPhases,
  resolveRegistrationPrice,
  upsertPhaseCommitteePrice,
} from "./pricing";
import type { PricingPhase, RegistrationCategory } from "./types";

const committees = [
  { id: "c1", name: "UNSC" },
  { id: "c2", name: "UNGA" },
];

describe("committee phase pricing helpers", () => {
  it("buildDefaultCommitteePrices maps all committees", () => {
    const rows = buildDefaultCommitteePrices(committees, 1500);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ committeeId: "c1", committeeName: "UNSC", price: 1500 });
  });

  it("upsertPhaseCommitteePrice updates and inserts", () => {
    const phase: PricingPhase = {
      id: "p1",
      name: "Early",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      basePrice: 1000,
      committeePrices: [],
    };
    const withNew = upsertPhaseCommitteePrice(phase, "c1", "UNSC", 2500);
    expect(withNew.committeePrices[0]?.price).toBe(2500);
    const withUpdate = upsertPhaseCommitteePrice(withNew, "c1", "UNSC", 3000);
    expect(withUpdate.committeePrices[0]?.price).toBe(3000);
  });

  it("mergeNewCommitteesIntoPhases appends missing committees only", () => {
    const phases: PricingPhase[] = [
      {
        id: "p1",
        name: "Early",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        basePrice: 800,
        committeePrices: buildDefaultCommitteePrices([committees[0]], 800),
      },
    ];
    const merged = mergeNewCommitteesIntoPhases(phases, committees);
    expect(merged[0]?.committeePrices).toHaveLength(2);
    expect(merged[0]?.committeePrices.find((e) => e.committeeId === "c2")?.price).toBe(800);
  });

  it("applyPhaseBasePriceToAllCommittees resets rows", () => {
    const phase: PricingPhase = {
      id: "p1",
      name: "Early",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      basePrice: 500,
      committeePrices: buildDefaultCommitteePrices(committees, 999),
    };
    const next = applyPhaseBasePriceToAllCommittees(phase, committees);
    expect(next.committeePrices.every((e) => e.price === 500)).toBe(true);
  });
});

describe("pricing phase completeness", () => {
  const completePhase: PricingPhase = {
    id: "p1",
    name: "Early",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    basePrice: 1000,
    committeePrices: [],
  };

  it("isPricingPhaseComplete returns true for valid phases", () => {
    expect(isPricingPhaseComplete(completePhase)).toBe(true);
  });

  it("isPricingPhaseComplete returns false when dates or name are missing", () => {
    expect(isPricingPhaseComplete({ ...completePhase, startDate: "" })).toBe(false);
    expect(isPricingPhaseComplete({ ...completePhase, endDate: "" })).toBe(false);
    expect(isPricingPhaseComplete({ ...completePhase, name: "" })).toBe(false);
  });

  it("findIncompletePricingPhases collects incomplete phases across categories", () => {
    const incomplete = findIncompletePricingPhases([
      {
        pricingPhases: [
          completePhase,
          { ...completePhase, id: "p2", name: "New Phase", startDate: "", endDate: "" },
        ],
      },
    ]);
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]?.name).toBe("New Phase");
  });

  it("formatIncompletePricingPhasesMessage lists incomplete phase names", () => {
    const message = formatIncompletePricingPhasesMessage([
      { ...completePhase, name: "New Phase", startDate: "", endDate: "" },
    ]);
    expect(message).toContain("New Phase");
    expect(message).toContain("start date, end date");
  });
});

describe("resolveRegistrationPrice", () => {
  const category: RegistrationCategory = {
    id: "cat-delegate",
    name: "Delegate",
    description: "",
    basePrice: 1000,
    requiresCommitteeSelection: true,
    formFields: [],
    pricingPhases: [
      {
        id: "p1",
        name: "Active",
        startDate: "2020-01-01",
        endDate: "2030-12-31",
        basePrice: 1200,
        committeePrices: [
          { committeeId: "c1", committeeName: "UNSC", price: 2000 },
          { committeeId: "c2", committeeName: "UNGA", price: 1500 },
        ],
      },
    ],
  };

  it("uses committee override when committee is selected", () => {
    const result = resolveRegistrationPrice(category, "c1", new Date("2026-06-01"));
    expect(result.amount).toBe(2000);
    expect(result.source).toBe("phase-committee-override");
  });

  it("falls back to phase base when committee has no override row", () => {
    const sparse: RegistrationCategory = {
      ...category,
      pricingPhases: [
        {
          ...category.pricingPhases[0],
          committeePrices: [],
        },
      ],
    };
    const result = resolveRegistrationPrice(sparse, "c1", new Date("2026-06-01"));
    expect(result.amount).toBe(1200);
    expect(result.source).toBe("phase-base");
  });
});
