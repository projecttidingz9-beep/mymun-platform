import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/password", () => ({
  hashPassword: vi.fn(() => Promise.resolve("hashed")),
  validateNewPassword: vi.fn(() => null),
}));

vi.mock("@/lib/server/session-token", () => ({
  signSessionToken: vi.fn(() => Promise.resolve("session.jwt")),
}));

vi.mock("@/lib/server/rate-limit-db", () => ({
  consumeRateLimitBucket: vi.fn(() => Promise.resolve(true)),
}));

describe("POST /api/auth/register", () => {
  beforeEach(async () => {
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.create).mockReset();
  });

  it("returns 409 when email already exists", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as never);

    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "Taken@Example.com",
        password: "ValidPass123!",
        name: "Someone",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(vi.mocked(prisma.user.create)).not.toHaveBeenCalled();
  });
});
