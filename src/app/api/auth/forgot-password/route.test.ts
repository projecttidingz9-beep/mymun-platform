import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const RAW_RESET_TOKEN = "SHOULD_NEVER_APPEAR_IN_LOGS_XYZ";

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(() => Promise.resolve({ data: { id: "email-1" } })),
}));

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
      send: resendSendMock,
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
  const prevPublicUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "noreply@test.com";
    delete process.env.NEXT_PUBLIC_APP_URL;

    resendSendMock.mockReset();
    resendSendMock.mockResolvedValue({ data: { id: "email-1" } });

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
    vi.unstubAllEnvs();
    process.env.RESEND_API_KEY = prevKey;
    process.env.RESEND_FROM_EMAIL = prevFrom;
    if (prevPublicUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = prevPublicUrl;
    }
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

  it("returns 503 email_not_configured when Resend env is missing in production", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    vi.stubEnv("NODE_ENV", "production");

    const req = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "person@test.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);

    const body = (await res.json()) as { error?: string; code?: string; devResetUrl?: string };
    expect(body.code).toBe("email_not_configured");
    expect(body.error).toMatch(/not configured/i);
    expect(body.devResetUrl).toBeUndefined();

    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("returns devResetUrl when Resend env is missing outside production", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    vi.stubEnv("NODE_ENV", "test");

    const req = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "person@test.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok?: boolean; devResetUrl?: string };
    expect(body.ok).toBe(true);
    expect(body.devResetUrl).toContain("http://localhost:3000/reset-password?token=");
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("uses NEXT_PUBLIC_APP_URL in reset link when sending email", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";

    const req = new NextRequest("http://localhost:9999/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "person@test.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(resendSendMock).toHaveBeenCalled();
    const calls = resendSendMock.mock.calls as unknown as Array<[{ text?: string }]>;
    expect(calls[0]?.[0]?.text).toContain("https://app.example.com/reset-password?token=");
    expect(calls[0]?.[0]?.text).not.toContain("http://localhost:9999");
  });

  it("returns 503 with error JSON when Resend send fails", async () => {
    resendSendMock.mockRejectedValueOnce(new Error("Resend API error"));

    const req = new NextRequest("http://localhost/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "person@test.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);

    const body = (await res.json()) as { error?: string; code?: string };
    expect(body.error).toBe("Could not send reset email. Please try again later.");
    expect(body.code).toBe("email_send_failed");

    const { logger } = await import("@/lib/server/logger");
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      "password_reset_email_send_failed",
      expect.objectContaining({ userId: "u1", error: "Resend API error" })
    );
  });

  it("returns 500 with error JSON when an unexpected error occurs", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error("database unavailable"));

    const req = new NextRequest("http://localhost/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: "person@test.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error?: string; code?: string };
    expect(body.error).toBe("Could not process password reset. Please try again.");
    expect(body.code).toBe("FORGOT_PASSWORD_FAILED");

    const { logger } = await import("@/lib/server/logger");
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      "forgot_password_failed",
      expect.objectContaining({ error: "database unavailable" })
    );
  });
});
