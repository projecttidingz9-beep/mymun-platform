import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { MARKETPLACE_DETAIL_CACHE_CONTROL } from "@/lib/server/http-cache";

vi.mock("@/lib/server/load-public-checkout-config", () => ({
  loadPublicCheckoutConfig: vi.fn(),
}));

describe("GET /api/marketplace/[eventId]/checkout-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when published event not found", async () => {
    const { loadPublicCheckoutConfig } = await import("@/lib/server/load-public-checkout-config");
    vi.mocked(loadPublicCheckoutConfig).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/marketplace/missing/checkout-config");
    const res = await GET(req, { params: Promise.resolve({ eventId: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns checkout config for published event", async () => {
    const { loadPublicCheckoutConfig } = await import("@/lib/server/load-public-checkout-config");
    vi.mocked(loadPublicCheckoutConfig).mockResolvedValue({
      eventId: "evt-1",
      currency: "INR",
      registrationCategories: [
        {
          id: "cat-default",
          name: "Delegate Registration",
          description: "",
          applicationType: "delegate",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: true,
          formFields: [],
          pricingPhases: [],
        },
      ],
      committees: [],
    });

    const req = new NextRequest("http://localhost/api/marketplace/evt-1/checkout-config");
    const res = await GET(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { registrationCategories: Array<{ id: string }> };
    expect(body.registrationCategories[0]?.id).toBe("cat-default");
    expect(res.headers.get("Cache-Control")).toBe(MARKETPLACE_DETAIL_CACHE_CONTROL);
  });
});
