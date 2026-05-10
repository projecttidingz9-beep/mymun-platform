import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const RAW_RESET_TOKEN = "SHOULD_NEVER_APPEAR_IN_LOGS_XYZ";

vi.mock("@/lib/server/reset-token", () => ({
  createPasswordResetToken: vi.fn(() => ({
    rawToken: RAW_RESET_TOKEN,
    tokenHash: "hashed-token-value",
  })),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    passwordResetToken: {
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      create: vi.fn(() => Promise.resolve({ id: "prt-1" })),
    },
  },
}));

vi.mock("@/lib/server/rate-limit-db", () => ({
  consumeRateLimitBucket: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn(() => Promise.resolve({ data: { id: "email-1" } })),
    },
  })),
}));

vi.mock("@/lib/server/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("POST /api/auth/forgot-password", () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevFrom = process.env.RESEND_FROM_EMAIL;

  beforeEach(async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "noreply@test.com";

    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "person@test.com",
      name: "Person",
      deletedAt: null,
    } as never);

    const { logger } = await import("@/lib/server/logger");
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = prevKey;
    process.env.RESEND_FROM_EMAIL = prevFrom;
  });

  async function allLoggerPayloads() {
    const { logger } = await import("@/lib/server/logger");
    const collect = (fn: typeof logger.info) =>
      vi.mocked(fn).mock.calls.map((args) => JSON.stringify(args)).join("\n");
    return collect(logger.info) + collect(logger.warn) + collect(logger.error);
  }

  it("never logs the raw reset token", async () => {
    const req = new NextRequest("http://localhost/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "person@test.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const leaked = await allLoggerPayloads();
    expect(leaked).not.toContain(RAW_RESET_TOKEN);
    expect(leaked).not.toContain(encodeURIComponent(RAW_RESET_TOKEN));
  });
});
