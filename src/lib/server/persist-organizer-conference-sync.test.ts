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
  mapConferenceStatusToEvent,
  resolveEventStatusForSync,
} from "./persist-organizer-conference-sync";

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

  it("honors explicit draft intent after rejection", () => {
    expect(resolveEventStatusForSync("REVIEW", "Draft")).toBe("DRAFT");
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
});
