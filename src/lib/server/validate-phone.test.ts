import { describe, expect, it } from "vitest";
import {
  isValidIndianMobilePhone,
  normalizeIndianMobilePhone,
  parseIndianMobilePhone,
} from "@/lib/server/validate-phone";

describe("validate-phone", () => {
  it("normalizes +91 prefix", () => {
    expect(normalizeIndianMobilePhone("+91 98765 43210")).toBe("9876543210");
  });

  it("accepts valid Indian mobile numbers", () => {
    expect(isValidIndianMobilePhone("9876543210")).toBe(true);
    expect(isValidIndianMobilePhone("+919876543210")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidIndianMobilePhone("12345")).toBe(false);
    expect(isValidIndianMobilePhone("5876543210")).toBe(false);
  });

  it("parses phone from formAnswers", () => {
    expect(parseIndianMobilePhone({ formAnswers: { phone: "9876543210" } })).toBe("9876543210");
  });
});
