import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteConferenceAsAdmin, moderateConference } from "./admin-conference-moderation";
import { prisma } from "./prisma";
import { mergeOrganizerStoredBlob } from "./organizer-config-store";

vi.mock("./prisma", () => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("./organizer-config-store", () => ({
  mergeOrganizerStoredBlob: vi.fn(() => Promise.resolve()),
}));

vi.mock("./map-managed-event-to-organizer-conference", () => ({
  mapManagedEventToOrganizerConference: vi.fn(() =>
    Promise.resolve({
      title: "Test MUN",
      ownerEmail: "org@example.com",
      committees: [],
      registrationCategories: [],
    })
  ),
}));

vi.mock("./env", () => ({
  env: {
    resendApiKey: () => undefined,
    resendFromEmail: () => undefined,
  },
}));

vi.mock("./logger", () => ({
  logger: { error: vi.fn() },
}));

describe("moderateConference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: "evt-1",
      title: "Test MUN",
      status: "REVIEW",
      owner: { email: "org@example.com" },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        event: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      await callback(tx as never);
    });
  });

  it("approves a review event to PUBLISHED", async () => {
    const result = await moderateConference({
      eventId: "evt-1",
      action: "approve",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(result.status).toBe("PUBLISHED");
    expect(mergeOrganizerStoredBlob).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({ status: "Published", adminRejectionNote: "" })
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects a review event to DRAFT", async () => {
    const result = await moderateConference({
      eventId: "evt-1",
      action: "reject",
      note: "Missing committee details",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(result.status).toBe("DRAFT");
    expect(mergeOrganizerStoredBlob).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({
        status: "Draft",
        adminRejectionNote: "Missing committee details",
      })
    );
  });
});

describe("deleteConferenceAsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        event: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      await callback(tx as never);
    });
  });

  it("soft-deletes a published conference", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: "evt-1",
      title: "Test MUN",
      status: "PUBLISHED",
      owner: { email: "org@example.com" },
    } as never);

    const result = await deleteConferenceAsAdmin({
      eventId: "evt-1",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });

    expect(result.eventId).toBe("evt-1");
    expect(result.title).toBe("Test MUN");
    expect(mergeOrganizerStoredBlob).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({ status: "Draft" })
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects delete for non-published events", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: "evt-1",
      title: "Test MUN",
      status: "REVIEW",
      owner: { email: "org@example.com" },
    } as never);

    await expect(
      deleteConferenceAsAdmin({
        eventId: "evt-1",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      })
    ).rejects.toThrow("Only published conferences");
  });

  it("throws when event is not found", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

    await expect(
      deleteConferenceAsAdmin({
        eventId: "missing",
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
      })
    ).rejects.toThrow("Event not found.");
  });
});
