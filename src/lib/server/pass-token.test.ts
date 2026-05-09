import { describe, expect, it } from "vitest";
import { hashToken } from "./pass-token";

describe("hashToken", () => {
  it("returns deterministic sha256 hash", () => {
    const first = hashToken("sample-token");
    const second = hashToken("sample-token");
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });
});

