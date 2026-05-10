import { describe, expect, it } from "vitest";
import { contactBodySchema } from "./contact";

describe("contactBodySchema", () => {
  it("accepts valid payload", () => {
    const r = contactBodySchema.safeParse({
      email: " a@b.co ",
      message: "Hello world this is long enough",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("a@b.co");
      expect(r.data.message).toBe("Hello world this is long enough");
    }
  });

  it("rejects short message", () => {
    const r = contactBodySchema.safeParse({ email: "a@b.co", message: "short" });
    expect(r.success).toBe(false);
  });
});
