import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/marketplace-public", () => ({
  mapPublishedEventToConference: vi.fn((event: { id: string }) => ({
    id: event.id,
    title: "Mapped",
  })),
}));

describe("GET /api/marketplace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only published events mapped for catalog", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    const { mapPublishedEventToConference } = await import("@/lib/server/marketplace-public");
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { id: "evt-published" },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { conferences: Array<{ id: string }> };
    expect(body.conferences).toEqual([{ id: "evt-published", title: "Mapped" }]);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", deletedAt: null },
      })
    );
    expect(mapPublishedEventToConference).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
