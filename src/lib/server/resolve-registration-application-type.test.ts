import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRegistrationApplicationType } from "./resolve-registration-application-type";

vi.mock("@/lib/server/organizer-config-store", () => ({
  getOrganizerStoredBlob: vi.fn(),
}));

describe("resolveRegistrationApplicationType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns applicationType from organizer category config when names match", async () => {
    const { getOrganizerStoredBlob } = await import("@/lib/server/organizer-config-store");
    vi.mocked(getOrganizerStoredBlob).mockResolvedValue({
      registrationCategories: [
        { id: "cat-chair", name: "Chair Registration", applicationType: "chair" },
      ],
    });

    const type = await resolveRegistrationApplicationType("evt-1", "Chair Registration");
    expect(type).toBe("chair");
  });

  it("infers chair from category name when config is missing", async () => {
    const { getOrganizerStoredBlob } = await import("@/lib/server/organizer-config-store");
    vi.mocked(getOrganizerStoredBlob).mockResolvedValue({});

    const type = await resolveRegistrationApplicationType("evt-1", "Executive Chair");
    expect(type).toBe("chair");
  });

  it("uses preloaded blob without fetching again", async () => {
    const { getOrganizerStoredBlob } = await import("@/lib/server/organizer-config-store");
    const type = await resolveRegistrationApplicationType("evt-1", "Chair Registration", {
      registrationCategories: [
        { id: "cat-chair", name: "Chair Registration", applicationType: "chair" },
      ],
    });
    expect(type).toBe("chair");
    expect(getOrganizerStoredBlob).not.toHaveBeenCalled();
  });
});
