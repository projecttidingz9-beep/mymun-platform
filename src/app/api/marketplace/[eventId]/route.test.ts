import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { MARKETPLACE_DETAIL_CACHE_CONTROL } from "@/lib/server/http-cache";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/marketplace-public", () => ({
  mapPublishedEventToPublicDetail: vi.fn(() => ({
    id: "evt-1",
    title: "Public Detail",
    whatIsIncluded: ["Kit"],
  })),
}));

describe("GET /api/marketplace/[eventId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when published event not found", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/marketplace/missing");
    const res = await GET(req, { params: Promise.resolve({ eventId: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns public detail for published event", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: "evt-1", reviews: [] } as never);

    const req = new NextRequest("http://localhost/api/marketplace/evt-1");
    const res = await GET(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { conference: { title: string } };
    expect(body.conference.title).toBe("Public Detail");
    expect(res.headers.get("Cache-Control")).toBe(MARKETPLACE_DETAIL_CACHE_CONTROL);
  });
});
