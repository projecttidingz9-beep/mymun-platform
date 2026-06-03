import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  env: {
    passQrSecret: () => "test-pass-secret-32chars-minimum!!",
  },
}));

import { hashToken, signPassToken } from "./pass-token";

describe("pass-token", () => {
  it("produces identical tokens for the same claims (deterministic QR)", async () => {
    const claims = {
      passId: "pass-1",
      registrationId: "reg-1",
      eventId: "evt-1",
      nonce: "fixed-nonce-abc",
    };
    const exp = new Date("2027-06-01T00:00:00.000Z");
    const a = await signPassToken(claims, exp);
    const b = await signPassToken(claims, exp);
    expect(a).toBe(b);
    expect(hashToken(a)).toBe(hashToken(b));
  });

  it("produces different tokens when nonce changes", async () => {
    const exp = new Date("2027-06-01T00:00:00.000Z");
    const a = await signPassToken(
      {
        passId: "pass-1",
        registrationId: "reg-1",
        eventId: "evt-1",
        nonce: "nonce-a",
      },
      exp
    );
    const b = await signPassToken(
      {
        passId: "pass-1",
        registrationId: "reg-1",
        eventId: "evt-1",
        nonce: "nonce-b",
      },
      exp
    );
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
