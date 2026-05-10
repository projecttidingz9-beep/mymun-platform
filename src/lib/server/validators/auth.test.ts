import { describe, expect, it } from "vitest";
import { forgotPasswordBodySchema, loginBodySchema, registerBodySchema } from "./auth";

describe("auth validators", () => {
  it("registerBodySchema normalizes optional role", () => {
    const r = registerBodySchema.safeParse({
      email: "x@y.com",
      password: "secret",
      name: "Test User",
    });
    expect(r.success).toBe(true);
  });

  it("loginBodySchema requires email shape", () => {
    expect(loginBodySchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(loginBodySchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("forgotPasswordBodySchema requires email", () => {
    expect(forgotPasswordBodySchema.safeParse({ email: "bad" }).success).toBe(false);
    expect(forgotPasswordBodySchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });
});
