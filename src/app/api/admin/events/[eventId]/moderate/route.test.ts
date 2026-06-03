import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/server/auth", () => ({
  getRequestActor: vi.fn(),
  isSuperAdmin: vi.fn(),
  resolveActorUserId: vi.fn(),
}));

vi.mock("@/lib/server/admin-conference-moderation", () => ({
  moderateConference: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/server/marketplace-queries", () => ({
  MARKETPLACE_CACHE_TAG: "marketplace",
}));

describe("POST /api/admin/events/[eventId]/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-super-admin", async () => {
    const { getRequestActor, isSuperAdmin } = await import("@/lib/server/auth");
    vi.mocked(getRequestActor).mockResolvedValue({
      email: "user@example.com",
      role: "delegate",
    });
    vi.mocked(isSuperAdmin).mockReturnValue(false);

    const req = new NextRequest("http://localhost/api/admin/events/evt-1/moderate", {
      method: "POST",
      body: JSON.stringify({ action: "approve" }),
    });

    const res = await POST(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid action", async () => {
    const { getRequestActor, isSuperAdmin, resolveActorUserId } = await import("@/lib/server/auth");
    vi.mocked(getRequestActor).mockResolvedValue({
      email: "admin@example.com",
      role: "admin",
    });
    vi.mocked(isSuperAdmin).mockReturnValue(true);
    vi.mocked(resolveActorUserId).mockResolvedValue("admin-id");

    const req = new NextRequest("http://localhost/api/admin/events/evt-1/moderate", {
      method: "POST",
      body: JSON.stringify({ action: "archive" }),
    });

    const res = await POST(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(400);
  });
});
