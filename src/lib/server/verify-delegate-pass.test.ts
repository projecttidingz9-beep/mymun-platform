import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, requireEventOrganizerAccessMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  requireEventOrganizerAccessMock: vi.fn(),
}));

vi.mock("@/lib/server/pass-token", () => ({
  verifyPassToken: vi.fn(() =>
    Promise.resolve({ passId: "pass-1", registrationId: "reg-1", eventId: "evt-1" })
  ),
  hashToken: vi.fn(() => "hash-1"),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    delegatePass: { findUnique },
  },
}));

vi.mock("@/lib/server/auth", () => ({
  requireOrganizer: vi.fn((actor: { role: string } | null) =>
    actor?.role === "organizer" || actor?.role === "admin"
  ),
  requireEventOrganizerAccess: requireEventOrganizerAccessMock,
}));

import {
  assertOrganizerCanAccessPass,
  isPassAlreadyUsed,
  loadPassFromQrToken,
} from "./verify-delegate-pass";

const releasedAt = new Date(Date.now() - 60_000);

function basePass(overrides: Record<string, unknown> = {}) {
  return {
    id: "pass-1",
    registrationId: "reg-1",
    eventId: "evt-1",
    qrTokenHash: "hash-1",
    releaseAt: releasedAt,
    issuedAt: new Date(),
    status: "ISSUED",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    registration: {
      id: "reg-1",
      userId: "user-1",
      eventId: "evt-1",
      categoryName: "Delegate",
      committeeName: "UNSC",
      portfolioName: null,
      amount: 0,
      paid: true,
      status: "ALLOTTED",
      checkedIn: false,
      checkedInAt: null,
      deletedAt: null,
      allottedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "user-1", email: "d@test.com", name: "Delegate" },
      event: { id: "evt-1", title: "Test Conf", startDate: new Date() },
    },
    checkins: [],
    ...overrides,
  };
}

describe("loadPassFromQrToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads a valid issued pass", async () => {
    findUnique.mockResolvedValue(basePass());
    const result = await loadPassFromQrToken("token");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pass.id).toBe("pass-1");
      expect(result.tokenHash).toBe("hash-1");
    }
  });

  it("rejects when pass is not released", async () => {
    findUnique.mockResolvedValue(
      basePass({ releaseAt: new Date(Date.now() + 86400000) })
    );
    const result = await loadPassFromQrToken("token");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });

  it("rejects revoked pass", async () => {
    findUnique.mockResolvedValue(basePass({ status: "REVOKED" }));
    const result = await loadPassFromQrToken("token");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });
});

describe("isPassAlreadyUsed", () => {
  it("returns true when registration is checked in", () => {
    expect(isPassAlreadyUsed(basePass({ registration: { ...basePass().registration, checkedIn: true } }) as never)).toBe(
      true
    );
  });

  it("returns true when checkin exists", () => {
    expect(
      isPassAlreadyUsed(
        basePass({
          checkins: [
            {
              id: "c1",
              passId: "pass-1",
              registrationId: "reg-1",
              eventId: "evt-1",
              checkedInAt: new Date(),
            },
          ],
        }) as never
      )
    ).toBe(true);
  });

  it("returns false for fresh pass", () => {
    expect(isPassAlreadyUsed(basePass() as never)).toBe(false);
  });
});

describe("assertOrganizerCanAccessPass", () => {
  beforeEach(() => {
    requireEventOrganizerAccessMock.mockResolvedValue(true);
  });

  it("allows organizer with event access", async () => {
    const result = await assertOrganizerCanAccessPass(
      { email: "o@test.com", role: "organizer" },
      "evt-1"
    );
    expect(result.ok).toBe(true);
  });

  it("denies delegate", async () => {
    const result = await assertOrganizerCanAccessPass(
      { email: "d@test.com", role: "delegate" },
      "evt-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
