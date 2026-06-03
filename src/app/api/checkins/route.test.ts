import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { POST } from "./route";

const {
  getRequestActor,
  loadPassFromQrToken,
  assertOrganizerCanAccessPass,
  isPassAlreadyUsed,
  transaction,
  userFindUnique,
  notificationCreate,
  checkinFindUnique,
} = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  loadPassFromQrToken: vi.fn(),
  assertOrganizerCanAccessPass: vi.fn(),
  isPassAlreadyUsed: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  notificationCreate: vi.fn(),
  checkinFindUnique: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  getRequestActor,
}));

vi.mock("@/lib/server/rate-limit-db", () => ({
  consumeRateLimitBucket: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/server/verify-delegate-pass", () => ({
  loadPassFromQrToken,
  assertOrganizerCanAccessPass,
  isPassAlreadyUsed,
  alreadyUsedResponse: () => ({
    valid: false,
    alreadyUsed: true,
    error: "Pass already used for check-in.",
  }),
  PASS_ALREADY_USED_ERROR: "Pass already used for check-in.",
}));

vi.mock("@/lib/server/require-verified-email", () => ({
  requireVerifiedEmail: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    notification: { create: notificationCreate },
    checkin: { findUnique: checkinFindUnique },
    $transaction: transaction,
  },
}));

const passPayload = {
  id: "pass-1",
  registrationId: "reg-1",
  eventId: "evt-1",
  registration: {
    userId: "user-1",
    user: { name: "Alex" },
    event: { title: "MUN 2026" },
    checkedIn: false,
    checkedInAt: null,
  },
  checkins: [],
};

describe("POST /api/checkins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestActor.mockResolvedValue({ email: "org@test.com", role: "organizer" });
    loadPassFromQrToken.mockResolvedValue({ ok: true, pass: passPayload, tokenHash: "hash" });
    assertOrganizerCanAccessPass.mockResolvedValue({ ok: true });
    isPassAlreadyUsed.mockReturnValue(false);
    userFindUnique.mockResolvedValue({ id: "org-1" });
    notificationCreate.mockResolvedValue({});
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        checkin: {
          create: vi.fn(() =>
            Promise.resolve({
              checkedInAt: new Date("2026-06-01T10:00:00.000Z"),
            })
          ),
        },
        registration: { update: vi.fn(() => Promise.resolve({})) },
        delegatePass: { update: vi.fn(() => Promise.resolve({ status: "REVOKED" })) },
      };
      return fn(tx);
    });
  });

  it("checks in delegate and returns success", async () => {
    const req = new NextRequest("http://localhost/api/checkins", {
      method: "POST",
      body: JSON.stringify({ qrToken: "token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkedIn).toBe(true);
    expect(body.duplicate).toBe(false);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("returns 409 when pass already used", async () => {
    isPassAlreadyUsed.mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/checkins", {
      method: "POST",
      body: JSON.stringify({ qrToken: "token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.alreadyUsed).toBe(true);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns 409 on unique constraint race", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
    });
    transaction.mockRejectedValueOnce(p2002);
    checkinFindUnique.mockResolvedValueOnce({
      checkedInAt: new Date("2026-06-01T09:00:00.000Z"),
    });

    const req = new NextRequest("http://localhost/api/checkins", {
      method: "POST",
      body: JSON.stringify({ qrToken: "token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.alreadyUsed).toBe(true);
  });
});
