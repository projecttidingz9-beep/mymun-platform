import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveServerRegistrationAmount } from "./resolve-registration-price";

const findUnique = vi.fn();
const getOrganizerStoredBlob = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    event: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

vi.mock("./organizer-config-store", () => ({
  getOrganizerStoredBlob: (...args: unknown[]) => getOrganizerStoredBlob(...args),
}));

describe("resolveServerRegistrationAmount", () => {
  beforeEach(() => {
    findUnique.mockReset();
    getOrganizerStoredBlob.mockReset();
    getOrganizerStoredBlob.mockResolvedValue({});
  });

  it("prefers blob pricing phases over DB basePrice of 0", async () => {
    findUnique.mockResolvedValue({
      currency: "INR",
      organizerConfig: {
        registrationCategories: [
          {
            categoryKey: "cat-delegate",
            name: "Delegate",
            description: null,
            applicationType: "delegate",
            isOpen: true,
            basePrice: 0,
            requiresCommitteeSelection: true,
          },
        ],
        pricingPhases: [],
        committees: [],
      },
    });
    getOrganizerStoredBlob.mockResolvedValue({
      registrationCategories: [
        {
          id: "cat-delegate",
          name: "Delegate",
          description: "",
          applicationType: "delegate",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: true,
          formFields: [],
          pricingPhases: [
            {
              id: "phase-early",
              name: "Early Bird",
              startDate: "2020-01-01",
              endDate: "2030-12-31",
              basePrice: 2500,
              committeePrices: [],
            },
          ],
        },
      ],
    });

    const result = await resolveServerRegistrationAmount({
      eventId: "evt-1",
      categoryId: "cat-delegate",
      referenceDate: new Date("2026-06-01"),
    });

    expect(result.amount).toBe(2500);
    expect(result.phaseName).toBe("Early Bird");
    expect(result.currency).toBe("INR");
  });

  it("uses blob phase committee override for selected committee", async () => {
    findUnique.mockResolvedValue({
      currency: "INR",
      organizerConfig: {
        registrationCategories: [
          {
            categoryKey: "cat-delegate",
            name: "Delegate",
            description: null,
            applicationType: "delegate",
            isOpen: true,
            basePrice: 0,
            requiresCommitteeSelection: true,
          },
        ],
        pricingPhases: [],
        committees: [{ id: "cm-unsc", basePrice: null }],
      },
    });
    getOrganizerStoredBlob.mockResolvedValue({
      registrationCategories: [
        {
          id: "cat-delegate",
          name: "Delegate",
          description: "",
          applicationType: "delegate",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: true,
          formFields: [],
          pricingPhases: [
            {
              id: "phase-early",
              name: "Early Bird",
              startDate: "2020-01-01",
              endDate: "2030-12-31",
              basePrice: 1000,
              committeePrices: [
                { committeeId: "cm-unsc", committeeName: "UNSC", price: 3200 },
                { committeeId: "cm-unga", committeeName: "UNGA", price: 1800 },
              ],
            },
          ],
        },
      ],
    });

    const result = await resolveServerRegistrationAmount({
      eventId: "evt-1",
      categoryId: "cat-delegate",
      committeeConfigId: "cm-unsc",
      referenceDate: new Date("2026-06-01"),
    });

    expect(result.amount).toBe(3200);
    expect(result.phaseName).toBe("Early Bird");
  });

  it("uses committeePriceJson override for selected committee (legacy event-wide phases)", async () => {
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

  it("falls back to phase base when committee has no json entry (legacy event-wide phases)", async () => {
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

  it("falls back to DB category with legacy event-wide phases when blob has no category", async () => {
    findUnique.mockResolvedValue({
      currency: "INR",
      organizerConfig: {
        registrationCategories: [
          {
            categoryKey: "cat-delegate",
            name: "Delegate",
            description: null,
            applicationType: "delegate",
            isOpen: true,
            basePrice: 500,
            requiresCommitteeSelection: true,
          },
        ],
        pricingPhases: [
          {
            id: "phase-1",
            name: "Standard",
            startDate: new Date("2020-01-01"),
            endDate: new Date("2030-12-31"),
            basePrice: 1500,
            committeePriceJson: null,
          },
        ],
        committees: [],
      },
    });
    getOrganizerStoredBlob.mockResolvedValue({ registrationCategories: [] });

    const result = await resolveServerRegistrationAmount({
      eventId: "evt-1",
      categoryId: "cat-delegate",
      referenceDate: new Date("2026-06-01"),
    });

    expect(result.amount).toBe(1500);
    expect(result.phaseName).toBe("Standard");
  });
});
