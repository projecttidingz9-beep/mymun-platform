import { describe, it, expect, vi } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("./organizer-config-store", () => ({
  mergeOrganizerStoredBlob: vi.fn(),
}));

import {
  ORGANIZER_SYNC_TX_OPTIONS,
  formatOrganizerSyncError,
  mapConferenceStatusToEvent,
  resolveEventStatusForSync,
} from "./persist-organizer-conference-sync";

describe("ORGANIZER_SYNC_TX_OPTIONS", () => {
  it("uses extended timeout for pooled Postgres sync", () => {
    expect(ORGANIZER_SYNC_TX_OPTIONS.timeout).toBe(30_000);
    expect(ORGANIZER_SYNC_TX_OPTIONS.maxWait).toBe(15_000);
  });
});

describe("formatOrganizerSyncError", () => {
  it("maps expired transaction errors to a friendly message", () => {
    expect(
      formatOrganizerSyncError(
        new Error(
          "Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms"
        )
      )
    ).toBe("Save took too long. Please try again in a moment.");
  });

  it("passes through other error messages", () => {
    expect(formatOrganizerSyncError(new Error("Event not found."))).toBe("Event not found.");
  });
});

describe("mapConferenceStatusToEvent", () => {
  it("maps organizer Published to REVIEW", () => {
    expect(mapConferenceStatusToEvent("Published")).toBe("REVIEW");
  });

  it("maps super-admin Published to PUBLISHED", () => {
    expect(mapConferenceStatusToEvent("Published", { skipReviewGate: true })).toBe("PUBLISHED");
  });

  it("maps Review to REVIEW", () => {
    expect(mapConferenceStatusToEvent("Review")).toBe("REVIEW");
  });

  it("maps Draft to DRAFT", () => {
    expect(mapConferenceStatusToEvent("Draft")).toBe("DRAFT");
  });
});

describe("resolveEventStatusForSync", () => {
  it("honors explicit publish intent from Draft", () => {
    expect(resolveEventStatusForSync("DRAFT", "Published")).toBe("REVIEW");
  });

  it("preserves REVIEW when stale client sends Draft", () => {
    expect(resolveEventStatusForSync("REVIEW", "Draft")).toBe("REVIEW");
  });

  it("preserves PUBLISHED when stale client sends Draft", () => {
    expect(resolveEventStatusForSync("PUBLISHED", "Draft")).toBe("PUBLISHED");
  });

  it("allows Draft when DB is already DRAFT", () => {
    expect(resolveEventStatusForSync("DRAFT", "Draft")).toBe("DRAFT");
  });

  it("preserves REVIEW on config-only sync with client Review", () => {
    expect(resolveEventStatusForSync("REVIEW", "Review")).toBe("REVIEW");
  });

  it("preserves PUBLISHED on incidental sync with client Review", () => {
    expect(resolveEventStatusForSync("PUBLISHED", "Review")).toBe("PUBLISHED");
  });

  it("allows Review client status to set REVIEW from DRAFT", () => {
    expect(resolveEventStatusForSync("DRAFT", "Review")).toBe("REVIEW");
  });

  it("preserves PUBLISHED when organiser edits with client Published", () => {
    expect(resolveEventStatusForSync("PUBLISHED", "Published")).toBe("PUBLISHED");
  });

  it("still maps Draft publish intent to REVIEW from DRAFT", () => {
    expect(resolveEventStatusForSync("DRAFT", "Published")).toBe("REVIEW");
  });
});
