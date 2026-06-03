import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveServerRegistrationAmount } from "./resolve-registration-price";

const findUnique = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    event: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

describe("resolveServerRegistrationAmount", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("uses committeePriceJson override for selected committee", async () => {
    findUnique.mockResolvedValue({
      currency: "INR",
      organizerConfig: {
        pricingPhases: [
          {
            id: "phase-1",
            name: "Early Bird",
            startDate: new Date("2020-01-01"),
            endDate: new Date("2030-12-31"),
            basePrice: 1000,
            committeePriceJson: JSON.stringify({ "cm-unsc": 2500, "cm-unga": 1800 }),
          },
        ],
        committees: [
          { id: "cm-unsc", basePrice: null },
          { id: "cm-unga", basePrice: null },
        ],
      },
    });

    const result = await resolveServerRegistrationAmount({
      eventId: "evt-1",
      committeeConfigId: "cm-unsc",
      referenceDate: new Date("2026-06-01"),
    });

    expect(result.amount).toBe(2500);
    expect(result.phaseName).toBe("Early Bird");
  });

  it("falls back to phase base when committee has no json entry", async () => {
    findUnique.mockResolvedValue({
      currency: "INR",
      organizerConfig: {
        pricingPhases: [
          {
            id: "phase-1",
            name: "Standard",
            startDate: new Date("2020-01-01"),
            endDate: new Date("2030-12-31"),
            basePrice: 1200,
            committeePriceJson: JSON.stringify({ "cm-unsc": 2500 }),
          },
        ],
        committees: [{ id: "cm-other", basePrice: null }],
      },
    });

    const result = await resolveServerRegistrationAmount({
      eventId: "evt-1",
      committeeConfigId: "cm-other",
      referenceDate: new Date("2026-06-01"),
    });

    expect(result.amount).toBe(1200);
  });
});
