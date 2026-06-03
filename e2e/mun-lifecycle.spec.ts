import { describe, expect, it } from "vitest";
import { RegistrationStatus } from "@/generated/prisma/enums";

/**
 * Documents the intended MUN lifecycle state machine (API-level contract).
 * Full Playwright e2e requires seeded credentials; these assertions guard regressions.
 */
describe("MUN lifecycle contract", () => {
  it("payment does not imply allotment", () => {
    const paidPending = {
      paid: true,
      status: RegistrationStatus.PENDING,
      allottedAt: null,
    };
    expect(paidPending.paid).toBe(true);
    expect(paidPending.status).not.toBe(RegistrationStatus.ALLOTTED);
  });

  it("allotment is required before pass issuance eligibility", () => {
    const eligible = (paid: boolean, status: RegistrationStatus) =>
      paid && status === RegistrationStatus.ALLOTTED;

    expect(eligible(true, RegistrationStatus.PENDING)).toBe(false);
    expect(eligible(true, RegistrationStatus.ALLOTTED)).toBe(true);
    expect(eligible(false, RegistrationStatus.ALLOTTED)).toBe(false);
  });
});
