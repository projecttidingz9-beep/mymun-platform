import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RegistrationCategory } from "@/lib/types";

const mergeOrganizerStoredBlob = vi.fn();
const deleteManyCategories = vi.fn();
const createManyCategories = vi.fn();
const deleteManyPhases = vi.fn();
const createManyPhases = vi.fn();
const findUniqueConfig = vi.fn();

vi.mock("./organizer-config-store", () => ({
  mergeOrganizerStoredBlob: (...args: unknown[]) => mergeOrganizerStoredBlob(...args),
}));

vi.mock("./prisma", () => ({
  runPrismaTransaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      organizerConferenceConfig: {
        findUnique: findUniqueConfig,
      },
      registrationCategoryConfig: {
        deleteMany: deleteManyCategories,
        createMany: createManyCategories,
      },
      pricingPhaseConfig: {
        deleteMany: deleteManyPhases,
        createMany: createManyPhases,
      },
    };
    await fn(tx);
  }),
}));

import { persistRegistrationCategories, syncRegistrationCategoriesToDb } from "./persist-registration-categories";

const chairCategory: RegistrationCategory = {
  id: "cat-chair",
  name: "Chair Registration",
  description: "Executive board and chair applications.",
  applicationType: "chair",
  isOpen: true,
  basePrice: 0,
  requiresCommitteeSelection: true,
  formFields: [],
  pricingPhases: [],
};

describe("persistRegistrationCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueConfig.mockResolvedValue({ id: "cfg-1" });
  });

  it("merges categories into blob and replaces relational category rows", async () => {
    await persistRegistrationCategories("evt-1", [chairCategory]);

    expect(mergeOrganizerStoredBlob).toHaveBeenCalledWith("evt-1", {
      registrationCategories: [chairCategory],
    });
    expect(deleteManyCategories).toHaveBeenCalledWith({ where: { organizerConfigId: "cfg-1" } });
    expect(createManyCategories).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          categoryKey: "cat-chair",
          applicationType: "chair",
          name: "Chair Registration",
        }),
      ],
      skipDuplicates: true,
    });
    expect(deleteManyPhases).toHaveBeenCalled();
  });

  it("throws when organizer config is missing", async () => {
    findUniqueConfig.mockResolvedValue(null);
    await expect(persistRegistrationCategories("evt-missing", [chairCategory])).rejects.toThrow(
      "OrganizerConferenceConfig missing for event."
    );
  });

  it("throws a readable error when pricing phases have invalid dates", async () => {
    const categoryWithIncompletePhase: RegistrationCategory = {
      id: "cat-delegate",
      name: "Delegate Registration",
      description: "",
      applicationType: "delegate",
      isOpen: true,
      basePrice: 3000,
      requiresCommitteeSelection: true,
      formFields: [],
      pricingPhases: [
        {
          id: "phase-1",
          name: "New Phase",
          startDate: "",
          endDate: "",
          basePrice: 3000,
          committeePrices: [],
        },
      ],
    };

    await expect(
      persistRegistrationCategories("evt-1", [categoryWithIncompletePhase])
    ).rejects.toThrow(/New Phase/);
    expect(createManyPhases).not.toHaveBeenCalled();
  });
});

describe("syncRegistrationCategoriesToDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates duplicate category keys before createMany", async () => {
    const duplicateDelegate: RegistrationCategory = {
      id: "cat-delegate",
      name: "Delegate Registration",
      description: "First",
      applicationType: "delegate",
      isOpen: true,
      basePrice: 0,
      requiresCommitteeSelection: true,
      formFields: [],
      pricingPhases: [],
    };
    const duplicateDelegateUpdated: RegistrationCategory = {
      ...duplicateDelegate,
      name: "Delegate Registration (updated)",
      description: "Second wins",
    };

    const tx = {
      registrationCategoryConfig: {
        deleteMany: deleteManyCategories,
        createMany: createManyCategories,
      },
      pricingPhaseConfig: {
        deleteMany: deleteManyPhases,
      },
    };

    await syncRegistrationCategoriesToDb(
      tx as never,
      "cfg-1",
      [duplicateDelegate, duplicateDelegateUpdated]
    );

    expect(createManyCategories).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          categoryKey: "cat-delegate",
          name: "Delegate Registration (updated)",
          description: "Second wins",
        }),
      ],
      skipDuplicates: true,
    });
  });
});
