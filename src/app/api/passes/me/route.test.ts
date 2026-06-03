import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/server/auth", () => ({
  getRequestActor: vi.fn(),
}));

vi.mock("@/lib/server/pass-token", () => ({
  signPassToken: vi.fn(() => Promise.resolve("signed.stub.token")),
  passTokenExpiresAt: vi.fn(() => new Date("2027-01-01")),
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

vi.mock("@/lib/server/resolve-registration-application-type", () => ({
  resolveRegistrationApplicationType: vi.fn(() => Promise.resolve("delegate")),
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
          event: {
            id: "evt-1",
            title: "Test Conference",
            endDate: new Date("2026-12-01"),
          },
          pass: {
            id: "pass-1",
            registrationId: "reg-1",
            eventId: "evt-1",
            qrNonce: "nonce-1",
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

  it("hides legacy preference portfolio until registration is allotted", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    const releaseAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "delegate@test.com",
      name: "Delegate",
      registrations: [
        {
          id: "reg-pending",
          userId: "user-1",
          eventId: "evt-1",
          categoryName: "Delegate",
          committeeName: "UNSC",
          portfolioName: "China",
          status: "PENDING",
          checkedIn: false,
          checkedInAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          event: { id: "evt-1", title: "Test Conference", endDate: new Date("2026-12-01") },
          pass: {
            id: "pass-pending",
            registrationId: "reg-pending",
            eventId: "evt-1",
            qrNonce: "nonce-p",
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

    const res = await GET(new NextRequest("http://localhost/api/passes/me"));
    const body = await res.json();
    expect(body.passes[0].portfolioName).toBeNull();
    expect(body.passes[0].committeeName).toBeNull();
  });

  it("returns assigned portfolio when registration is allotted", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    const releaseAt = new Date(Date.now() - 60_000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "delegate@test.com",
      name: "Delegate",
      registrations: [
        {
          id: "reg-allotted",
          userId: "user-1",
          eventId: "evt-1",
          categoryName: "Delegate",
          committeeName: "UNSC",
          portfolioName: "China",
          status: "ALLOTTED",
          checkedIn: false,
          checkedInAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          event: { id: "evt-1", title: "Test Conference", endDate: new Date("2026-12-01") },
          pass: {
            id: "pass-allotted",
            registrationId: "reg-allotted",
            eventId: "evt-1",
            qrNonce: "nonce-a",
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

    const res = await GET(new NextRequest("http://localhost/api/passes/me"));
    const body = await res.json();
    expect(body.passes[0].portfolioName).toBe("China");
    expect(body.passes[0].committeeName).toBe("UNSC");
    expect(body.passes[0].released).toBe(true);
  });
});
