import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/server/auth", () => ({
  getRequestActor: vi.fn(),
}));

vi.mock("@/lib/server/pass-token", () => ({
  signPassToken: vi.fn(() => Promise.resolve("signed.stub.token")),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve("data:image/png;base64,stub")),
  },
}));

describe("GET /api/passes/me", () => {
  beforeEach(async () => {
    const auth = await import("@/lib/server/auth");
    vi.mocked(auth.getRequestActor).mockResolvedValue({
      email: "delegate@test.com",
      role: "delegate",
      name: "Delegate",
    });

    const releaseAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "delegate@test.com",
      name: "Delegate",
      registrations: [
        {
          id: "reg-1",
          userId: "user-1",
          eventId: "evt-1",
          categoryName: "General",
          committeeName: null,
          portfolioName: null,
          status: "CONFIRMED",
          checkedIn: false,
          checkedInAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          event: { id: "evt-1", title: "Test Conference" },
          pass: {
            id: "pass-1",
            registrationId: "reg-1",
            eventId: "evt-1",
            qrTokenHash: "hash",
            releaseAt,
            issuedAt: new Date(),
            status: "ISSUED",
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    } as never);
  });

  it("does not expose QR payload before pass release time", async () => {
    const req = new NextRequest("http://localhost/api/passes/me");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passes).toHaveLength(1);
    expect(body.passes[0].qrToken).toBeNull();
    expect(body.passes[0].qrImageDataUrl).toBeUndefined();
    expect(body.passes[0].released).toBe(false);
  });
});
