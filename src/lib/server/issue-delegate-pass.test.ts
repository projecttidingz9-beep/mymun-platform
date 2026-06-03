import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationStatus } from "@/generated/prisma/enums";

const { findUnique, delegatePassCreate, delegatePassUpdate, notificationCreate } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  delegatePassCreate: vi.fn(),
  delegatePassUpdate: vi.fn(),
  notificationCreate: vi.fn(),
}));

vi.mock("@/lib/server/pass-token", () => ({
  signPassToken: vi.fn(() => Promise.resolve("signed.stub.token")),
  hashToken: vi.fn(() => "hashed-token"),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    registration: { findUnique },
    delegatePass: { create: delegatePassCreate, update: delegatePassUpdate },
    notification: { create: notificationCreate },
  },
}));

import { issueDelegatePassForRegistration } from "./issue-delegate-pass";

const eventStart = new Date("2026-09-01T00:00:00.000Z");

function baseRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    userId: "user-1",
    eventId: "evt-1",
    categoryName: "Delegate",
    committeeName: null,
    portfolioName: null,
    amount: 0,
    paid: true,
    status: RegistrationStatus.ALLOTTED,
    allottedAt: new Date(),
    checkedIn: false,
    checkedInAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    event: { id: "evt-1", title: "Test Conference", startDate: eventStart },
    pass: null,
    ...overrides,
  };
}

describe("issueDelegatePassForRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delegatePassCreate.mockResolvedValue({
      id: "pass-1",
      registrationId: "reg-1",
      eventId: "evt-1",
      releaseAt: new Date(),
      qrTokenHash: "pending",
      status: "ISSUED",
    });
    delegatePassUpdate.mockResolvedValue({});
    notificationCreate.mockResolvedValue({});
  });

  it("issues a pass when paid and allotted", async () => {
    findUnique.mockResolvedValue(baseRegistration());

    const result = await issueDelegatePassForRegistration("reg-1", { immediateRelease: true });

    expect(result.issued).toBe(true);
    expect(result.alreadyIssued).toBe(false);
    expect(result.passId).toBe("pass-1");
    expect(result.qrToken).toBe("signed.stub.token");
    expect(delegatePassCreate).toHaveBeenCalledOnce();
    const createArg = delegatePassCreate.mock.calls[0][0];
    expect(createArg.data.releaseAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(notificationCreate).toHaveBeenCalledOnce();
  });

  it("skips when registration is not paid", async () => {
    findUnique.mockResolvedValue(baseRegistration({ paid: false }));

    const result = await issueDelegatePassForRegistration("reg-1", { immediateRelease: true });

    expect(result.issued).toBe(false);
    expect(result.skipReason).toBe("not_paid");
    expect(delegatePassCreate).not.toHaveBeenCalled();
  });

  it("skips when registration is not allotted", async () => {
    findUnique.mockResolvedValue(
      baseRegistration({ status: RegistrationStatus.PENDING })
    );

    const result = await issueDelegatePassForRegistration("reg-1", { immediateRelease: true });

    expect(result.issued).toBe(false);
    expect(result.skipReason).toBe("not_allotted");
    expect(delegatePassCreate).not.toHaveBeenCalled();
  });

  it("returns alreadyIssued when pass exists", async () => {
    const existingRelease = new Date("2026-08-20T00:00:00.000Z");
    findUnique.mockResolvedValue(
      baseRegistration({
        pass: {
          id: "pass-existing",
          registrationId: "reg-1",
          eventId: "evt-1",
          qrTokenHash: "hash",
          releaseAt: existingRelease,
          issuedAt: new Date(),
          status: "ISSUED",
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    );

    const result = await issueDelegatePassForRegistration("reg-1");

    expect(result.alreadyIssued).toBe(true);
    expect(result.passId).toBe("pass-existing");
    expect(delegatePassCreate).not.toHaveBeenCalled();
  });
});
