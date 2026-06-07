import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    event: { update: vi.fn() },
    organizerConferenceConfig: { update: vi.fn() },
  },
}));

vi.mock("@/lib/server/auth", () => ({
  getRequestActor: vi.fn(),
  requireOrganizer: vi.fn(),
  requireEventOrganizerAccess: vi.fn(),
  resolveActorUserId: vi.fn(),
}));

vi.mock("@/lib/server/organizer-config-store", () => ({
  getOrganizerPreviewConfig: vi.fn(async () => ({ registrationCategories: [] })),
  mergeOrganizerStoredBlob: vi.fn(),
}));

vi.mock("@/lib/server/persist-registration-categories", () => ({
  persistRegistrationCategories: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/server/marketplace-queries", () => ({
  MARKETPLACE_CACHE_TAG: "marketplace",
}));

import { PATCH } from "./route";

describe("PATCH /api/organizers/conference-config/[eventId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists registration categories when included in body", async () => {
    const auth = await import("@/lib/server/auth");
    const persist = await import("@/lib/server/persist-registration-categories");
    const { mergeOrganizerStoredBlob } = await import("@/lib/server/organizer-config-store");
    const { revalidateTag } = await import("next/cache");

    vi.mocked(auth.getRequestActor).mockResolvedValue({
      email: "org@example.com",
      role: "organizer",
    });
    vi.mocked(auth.requireOrganizer).mockReturnValue(true);
    vi.mocked(auth.requireEventOrganizerAccess).mockResolvedValue(true);
    vi.mocked(auth.resolveActorUserId).mockResolvedValue("user-1");

    const categories = [
      {
        id: "cat-chair",
        name: "Chair Registration",
        description: "",
        applicationType: "chair",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases: [],
      },
    ];

    const req = new NextRequest("http://localhost/api/organizers/conference-config/evt-1", {
      method: "PATCH",
      body: JSON.stringify({ registrationCategories: categories }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ eventId: "evt-1" }) });
    expect(res.status).toBe(200);
    expect(mergeOrganizerStoredBlob).toHaveBeenCalled();
    expect(persist.persistRegistrationCategories).toHaveBeenCalledWith("evt-1", categories);
    expect(revalidateTag).toHaveBeenCalled();
  });
});
