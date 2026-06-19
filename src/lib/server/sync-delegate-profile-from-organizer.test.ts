import { describe, it, expect } from "vitest";
import {
  appendAwardToProfile,
  roleLabelForApplicationType,
  upsertParticipationInProfile,
} from "./sync-delegate-profile-from-organizer";

describe("sync-delegate-profile-from-organizer", () => {
  it("maps application types to profile role labels", () => {
    expect(roleLabelForApplicationType("organizer")).toBe("Organising Committee");
    expect(roleLabelForApplicationType("chair", "Vice Chair")).toBe("Vice Chair");
    expect(roleLabelForApplicationType("delegation")).toBe("Delegation Head");
    expect(roleLabelForApplicationType("press")).toBe("Press Corps");
    expect(roleLabelForApplicationType("delegate")).toBe("Delegate");
  });

  it("upserts participation by event marker", () => {
    const first = upsertParticipationInProfile(
      { munParticipations: [] },
      {
        id: "part-sync-evt-1",
        conferenceName: "Test MUN",
        role: "Delegate",
      },
      "evt-1"
    );
    const second = upsertParticipationInProfile(first, {
      id: "part-sync-evt-1",
      conferenceName: "Test MUN",
      role: "Delegate",
      committee: "UNSC",
    }, "evt-1");

    const participations = (second as { munParticipations: Array<{ committee?: string }> }).munParticipations;
    expect(participations).toHaveLength(1);
    expect(participations[0]?.committee).toBe("UNSC");
  });

  it("appends awards and summary", () => {
    const { profile, summary } = appendAwardToProfile(
      { munAwards: [], munAwardsSummary: "Existing award - Old MUN" },
      {
        id: "award-1",
        title: "Best Delegate",
        conferenceName: "Hyd MUN",
        year: 2026,
      }
    );
    const awards = (profile as { munAwards: unknown[] }).munAwards;
    expect(awards).toHaveLength(1);
    expect(summary).toContain("Best Delegate - Hyd MUN");
  });
});
