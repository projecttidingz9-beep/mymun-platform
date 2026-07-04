import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { MARKETPLACE_CATALOG_CACHE_CONTROL } from "@/lib/server/http-cache";

vi.mock("@/lib/server/marketplace-queries", () => ({
  getCachedPublishedCatalog: vi.fn(),
}));

vi.mock("@/lib/server/marketplace-public", () => ({
  mapPublishedEventToConference: vi.fn((event: { id: string }) => ({
    id: event.id,
    title: "Mapped",
    description: "Full description",
    committees: [{ id: "c1", name: "UNSC", abbreviation: "UNSC", difficulty: "Intermediate", size: 15, allottedCount: 0 }],
  })),
}));

describe("GET /api/marketplace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only published events mapped for catalog", async () => {
    const { getCachedPublishedCatalog } = await import("@/lib/server/marketplace-queries");
    const { mapPublishedEventToConference } = await import("@/lib/server/marketplace-public");
    vi.mocked(getCachedPublishedCatalog).mockResolvedValue([
      { id: "evt-published" },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { conferences: Array<{ id: string }> };
    expect(body.conferences).toEqual([
      {
        id: "evt-published",
        title: "Mapped",
        description: "Full description",
        committees: [
          {
            id: "c1",
            name: "UNSC",
            abbreviation: "UNSC",
            topic1: "",
            topic2: "",
            difficulty: "Intermediate",
            size: 15,
            allottedCount: 0,
          },
        ],
      },
    ]);
    expect(getCachedPublishedCatalog).toHaveBeenCalledTimes(1);
    expect(mapPublishedEventToConference).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Cache-Control")).toBe(MARKETPLACE_CATALOG_CACHE_CONTROL);
  });
});
