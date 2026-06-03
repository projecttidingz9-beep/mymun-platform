import { describe, expect, it, vi } from "vitest";
import { RegistrationStatus } from "@/generated/prisma/enums";

vi.mock("@/lib/server/pass-token", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/pass-token")>("@/lib/server/pass-token");
  return {
    ...actual,
    verifyPassToken: vi.fn(async (token: string) => {
      if (token === "valid.token") {
        return {
          passId: "pass-1",
          registrationId: "reg-1",
          eventId: "evt-1",
          nonce: "nonce-1",
        };
      }
      throw new Error("invalid");
    }),
  };
});

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    delegatePass: {
      findFirst: vi.fn(),
    },
  },
}));

import { hashToken } from "@/lib/server/pass-token";
import { loadPassFromQrToken } from "./verify-delegate-pass";

describe("loadPassFromQrToken", () => {
  it("accepts a token whose hash matches stored qrNonce", async () => {
    const token = "valid.token";
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.delegatePass.findFirst).mockResolvedValue({
      id: "pass-1",
      registrationId: "reg-1",
      eventId: "evt-1",
      qrNonce: "nonce-1",
      qrTokenHash: hashToken(token),
      releaseAt: new Date(Date.now() - 60_000),
      status: "ISSUED",
      deletedAt: null,
      registration: {
        id: "reg-1",
        userId: "user-1",
        eventId: "evt-1",
        status: RegistrationStatus.ALLOTTED,
        checkedIn: false,
        user: { id: "user-1", name: "Delegate", email: "d@test.com" },
        event: { id: "evt-1", title: "Test MUN" },
      },
      checkins: [],
    } as never);

    const result = await loadPassFromQrToken(token);
    expect(result.ok).toBe(true);
  });
});
