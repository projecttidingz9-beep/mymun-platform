import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    passwordResetToken: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

vi.mock("@/lib/server/password", () => ({
  hashPassword: vi.fn(() => Promise.resolve("hashed")),
  validateNewPassword: vi.fn(() => null),
}));

vi.mock("@/lib/server/reset-token", () => ({
  hashResetToken: vi.fn(() => "hashed-token"),
}));

vi.mock("@/lib/server/rate-limit-db", () => ({
  consumeRateLimitBucket: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/server/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("POST /api/auth/reset-password", () => {
  beforeEach(async () => {
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.passwordResetToken.findFirst).mockReset();
  });

  it("returns 500 with code when an unexpected error occurs", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    const { logger } = await import("@/lib/server/logger");
    vi.mocked(prisma.passwordResetToken.findFirst).mockRejectedValueOnce(new Error("db down"));

    const req = new NextRequest("http://localhost/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: "reset-token",
        newPassword: "ValidPass123!",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string; code?: string };
    expect(body.error).toMatch(/could not reset password/i);
    expect(body.code).toBe("RESET_PASSWORD_FAILED");
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      "reset_password_failed",
      expect.objectContaining({ error: "db down" })
    );
  });
});
