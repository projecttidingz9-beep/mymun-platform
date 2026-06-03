import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/password", () => ({
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/server/session-token", () => ({
  signSessionToken: vi.fn(() => Promise.resolve("session.jwt")),
}));

vi.mock("@/lib/server/rate-limit-db", () => ({
  consumeRateLimitBucket: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/server/load-client-user", () => ({
  loadClientUserByEmail: vi.fn(() =>
    Promise.resolve({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      role: "delegate",
      avatar: "T",
      school: "",
      country: "",
      munExperienceSummary: "",
      munAwardsSummary: "",
      munParticipations: [],
      munAwards: [],
      profileVisibility: "public",
      registeredConferences: [],
      notifications: [],
    })
  ),
}));

vi.mock("@/lib/server/oauth-bridge", () => ({
  setMymunSessionCookie: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("returns 500 with code when an unexpected error occurs", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    const { logger } = await import("@/lib/server/logger");
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error("db down"));

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        password: "ValidPass123!",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string; code?: string };
    expect(body.error).toMatch(/could not sign in/i);
    expect(body.code).toBe("AUTH_LOGIN_FAILED");
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      "auth_login_failed",
      expect.objectContaining({ error: "db down" })
    );
  });

  it("returns user payload on successful login", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    const { setMymunSessionCookie } = await import("@/lib/server/oauth-bridge");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      role: "DELEGATE",
      passwordHash: "hash",
      deletedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: 0,
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never);

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        password: "ValidPass123!",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; user?: { email?: string } };
    expect(body.ok).toBe(true);
    expect(body.user?.email).toBe("user@example.com");
    expect(vi.mocked(setMymunSessionCookie)).toHaveBeenCalled();
  });
});
