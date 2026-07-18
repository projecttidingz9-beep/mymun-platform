import { describe, expect, it } from "vitest";
import { normalizeDelegationCode } from "@/lib/delegation-code";
import { generateDelegationCode } from "./delegation-code";

describe("delegation team codes", () => {
  it("generates human-friendly uppercase codes", () => {
    const code = generateDelegationCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });

  it("normalizes new short codes without changing legacy UUID tokens", () => {
    expect(normalizeDelegationCode(" abcd234567 ")).toBe("ABCD234567");
    expect(normalizeDelegationCode("seed-delegation-invite-token")).toBe(
      "seed-delegation-invite-token"
    );
  });

  it("generates different codes across calls", () => {
    expect(generateDelegationCode()).not.toBe(generateDelegationCode());
  });
});
