import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

vi.mock("@/lib/server/auth", () => ({
  getRequestActor: vi.fn(),
  isSuperAdmin: vi.fn(),
  requireOrganizer: vi.fn(),
  requireEventOrganizerAccess: vi.fn(),
}));

vi.mock("@/lib/server/persist-organizer-conference-sync", () => ({
  persistOrganizerConferenceSync: vi.fn(),
}));

vi.mock("@/lib/server/map-managed-event-to-organizer-conference", () => ({
  mapManagedEventToOrganizerConference: vi.fn(),
}));

describe("PUT /api/organizers/conferences/[eventId]/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for delegate role", async () => {
    const { getRequestActor, requireOrganizer } = await import("@/lib/server/auth");
    vi.mocked(getRequestActor).mockResolvedValue({
      email: "delegate@example.com",
      role: "delegate",
    });
    vi.mocked(requireOrganizer).mockReturnValue(false);

    const req = new NextRequest("http://localhost/api/organizers/conferences/evt-1/sync", {
      method: "PUT",
      body: JSON.stringify({ conference: { id: "evt-1" } }),
    });

    const res = await PUT(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when conference payload missing", async () => {
    const { getRequestActor, requireOrganizer, requireEventOrganizerAccess } =
      await import("@/lib/server/auth");
    vi.mocked(getRequestActor).mockResolvedValue({
      email: "org@example.com",
      role: "organizer",
    });
    vi.mocked(requireOrganizer).mockReturnValue(true);
    vi.mocked(requireEventOrganizerAccess).mockResolvedValue(true);

    const req = new NextRequest("http://localhost/api/organizers/conferences/evt-1/sync", {
      method: "PUT",
      body: JSON.stringify({}),
    });

    const res = await PUT(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(400);
  });

  it("persists conference for organizer with access", async () => {
    const auth = await import("@/lib/server/auth");
    const sync = await import("@/lib/server/persist-organizer-conference-sync");
    const map = await import("@/lib/server/map-managed-event-to-organizer-conference");

    vi.mocked(auth.getRequestActor).mockResolvedValue({
      email: "org@example.com",
      role: "organizer",
    });
    vi.mocked(auth.requireOrganizer).mockReturnValue(true);
    vi.mocked(auth.requireEventOrganizerAccess).mockResolvedValue(true);
    vi.mocked(auth.isSuperAdmin).mockReturnValue(false);
    vi.mocked(map.mapManagedEventToOrganizerConference).mockResolvedValue({
      id: "evt-1",
      title: "Synced",
    } as never);

    const conference = { id: "evt-1", title: "Updated", status: "Published" };
    const req = new NextRequest("http://localhost/api/organizers/conferences/evt-1/sync", {
      method: "PUT",
      body: JSON.stringify({ conference }),
    });

    const res = await PUT(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(200);
    expect(sync.persistOrganizerConferenceSync).toHaveBeenCalledWith("evt-1", conference, {
      skipReviewGate: false,
      syncStatus: true,
    });
    const body = (await res.json()) as { conference: { title: string } };
    expect(body.conference.title).toBe("Synced");
  });
});
