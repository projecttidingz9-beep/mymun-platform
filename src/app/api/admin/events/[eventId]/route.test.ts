import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";

vi.mock("@/lib/server/auth", () => ({
  getRequestActor: vi.fn(),
  isSuperAdmin: vi.fn(),
  resolveActorUserId: vi.fn(),
}));

vi.mock("@/lib/server/admin-conference-moderation", () => ({
  deleteConferenceAsAdmin: vi.fn(),
  getAdminReviewEventDetail: vi.fn(),
}));

describe("DELETE /api/admin/events/[eventId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-super-admin", async () => {
    const { getRequestActor, isSuperAdmin } = await import("@/lib/server/auth");
    vi.mocked(getRequestActor).mockResolvedValue({
      email: "user@example.com",
      role: "organizer",
    });
    vi.mocked(isSuperAdmin).mockReturnValue(false);

    const req = new NextRequest("http://localhost/api/admin/events/evt-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(403);
  });

  it("deletes published conference for super admin", async () => {
    const { getRequestActor, isSuperAdmin, resolveActorUserId } = await import("@/lib/server/auth");
    const { deleteConferenceAsAdmin } = await import("@/lib/server/admin-conference-moderation");

    vi.mocked(getRequestActor).mockResolvedValue({
      email: "admin@example.com",
      role: "admin",
    });
    vi.mocked(isSuperAdmin).mockReturnValue(true);
    vi.mocked(resolveActorUserId).mockResolvedValue("admin-id");
    vi.mocked(deleteConferenceAsAdmin).mockResolvedValue({
      eventId: "evt-1",
      title: "Test MUN",
      organizerEmail: "org@example.com",
    });

    const req = new NextRequest("http://localhost/api/admin/events/evt-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.eventId).toBe("evt-1");
  });
});
