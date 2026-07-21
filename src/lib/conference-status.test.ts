import { describe, expect, it } from "vitest";
import { resolveConferenceStatusBadge } from "@/lib/conference-status";

const ref = new Date("2026-06-15T12:00:00.000Z");

describe("resolveConferenceStatusBadge", () => {
  it("marks past conferences as ended", () => {
    expect(
      resolveConferenceStatusBadge({
        endDate: "2026-05-01",
        categories: [{ isOpen: true, pricingPhases: [] }],
        referenceDate: ref,
      })
    ).toBe("Event Ended");
  });

  it("shows register now when an active pricing phase exists", () => {
    expect(
      resolveConferenceStatusBadge({
        endDate: "2026-08-01",
        categories: [
          {
            isOpen: true,
            pricingPhases: [
              {
                id: "p1",
                name: "Early bird",
                startDate: "2026-06-01",
                endDate: "2026-06-30",
                basePrice: 1000,
                committeePrices: [],
              },
            ],
          },
        ],
        referenceDate: ref,
      })
    ).toBe("Register Now");
  });

  it("shows coming soon before the next pricing phase opens", () => {
    expect(
      resolveConferenceStatusBadge({
        endDate: "2026-08-01",
        categories: [
          {
            isOpen: true,
            pricingPhases: [
              {
                id: "p1",
                name: "Regular",
                startDate: "2026-07-01",
                endDate: "2026-07-31",
                basePrice: 1500,
                committeePrices: [],
              },
            ],
          },
        ],
        referenceDate: ref,
      })
    ).toBe("Coming Soon");
  });

  it("closes registration after the conference deadline even without phases", () => {
    expect(
      resolveConferenceStatusBadge({
        endDate: "2026-08-01",
        registrationDeadline: "2026-06-10",
        categories: [{ isOpen: true, pricingPhases: [] }],
        referenceDate: ref,
      })
    ).toBe("Registrations Closed");
  });

  it("keeps registration open without phases until the deadline", () => {
    expect(
      resolveConferenceStatusBadge({
        endDate: "2026-08-01",
        registrationDeadline: "2026-07-01",
        categories: [{ isOpen: true, pricingPhases: [] }],
        referenceDate: ref,
      })
    ).toBe("Register Now");
  });
});
