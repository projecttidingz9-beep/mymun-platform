import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const {
  getRequestActor,
  loadPassFromQrToken,
  assertOrganizerCanAccessPass,
  isPassAlreadyUsed,
} = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  loadPassFromQrToken: vi.fn(),
  assertOrganizerCanAccessPass: vi.fn(),
  isPassAlreadyUsed: vi.fn(),
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
}));

const passPayload = {
  id: "pass-1",
  registrationId: "reg-1",
  eventId: "evt-1",
  registration: {
    user: { name: "Alex", email: "alex@test.com" },
    event: { title: "MUN 2026" },
    committeeName: "UNSC",
    portfolioName: null,
    categoryName: "Delegate",
    checkedIn: false,
    checkedInAt: null,
  },
  checkins: [],
};

describe("POST /api/passes/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestActor.mockResolvedValue({ email: "org@test.com", role: "organizer" });
    loadPassFromQrToken.mockResolvedValue({ ok: true, pass: passPayload, tokenHash: "hash" });
    assertOrganizerCanAccessPass.mockResolvedValue({ ok: true });
    isPassAlreadyUsed.mockReturnValue(false);
  });

  it("returns valid delegate details for organizer", async () => {
    const req = new NextRequest("http://localhost/api/passes/verify", {
      method: "POST",
      body: JSON.stringify({ qrToken: "token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.delegateName).toBe("Alex");
    expect(body.checkedIn).toBe(false);
  });

  it("returns 403 for delegate role", async () => {
    getRequestActor.mockResolvedValue({ email: "d@test.com", role: "delegate" });
    assertOrganizerCanAccessPass.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Organizer role required.",
    });

    const req = new NextRequest("http://localhost/api/passes/verify", {
      method: "POST",
      body: JSON.stringify({ qrToken: "token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 409 when pass already used", async () => {
    isPassAlreadyUsed.mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/passes/verify", {
      method: "POST",
      body: JSON.stringify({ qrToken: "token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.alreadyUsed).toBe(true);
    expect(body.valid).toBe(false);
  });
});
