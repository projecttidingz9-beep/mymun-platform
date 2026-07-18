import {
  getCategoryRegistrationLabel,
  normalizeCategoryApplicationType,
  type RegistrationCategoryType,
} from "@/lib/registration-category-types";
import type { RegistrationCategory } from "@/lib/types";
import { getOrganizerStoredBlob } from "@/lib/server/organizer-config-store";

export async function loadOrganizerBlobsByEventIds(
  eventIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const unique = [...new Set(eventIds)];
  const entries = await Promise.all(
    unique.map(async (eventId) => [eventId, await getOrganizerStoredBlob(eventId)] as const)
  );
  return new Map(entries);
}

const CATEGORY_TYPES: RegistrationCategoryType[] = [
  "delegate",
  "chair",
  "delegation",
  "organizer",
  "secretariat",
  "other",
];

function inferFromCategoryName(categoryName: string): RegistrationCategoryType {
  const normalized = categoryName.trim().toLowerCase();
  if (!normalized) return "delegate";

  for (const type of CATEGORY_TYPES) {
    if (getCategoryRegistrationLabel(type).toLowerCase() === normalized) {
      return type;
    }
  }

  if (normalized.includes("chair")) return "chair";
  if (normalized.includes("secretariat")) return "secretariat";
  if (normalized.includes("organiz")) return "organizer";
  if (normalized.includes("delegation")) return "delegation";
  if (normalized.includes("delegate")) return "delegate";

  return "other";
}

export async function resolveRegistrationApplicationType(
  eventId: string,
  categoryName: string,
  preloadedBlob?: Record<string, unknown>
): Promise<RegistrationCategoryType> {
  const blob =
    preloadedBlob ??
    (await getOrganizerStoredBlob(eventId));
  const categories = Array.isArray(blob.registrationCategories)
    ? (blob.registrationCategories as RegistrationCategory[])
    : [];

  const normalized = categoryName.trim().toLowerCase();
  const match = categories.find((category) => category.name.trim().toLowerCase() === normalized);
  if (match?.applicationType) {
    return normalizeCategoryApplicationType(match.applicationType);
  }

  return inferFromCategoryName(categoryName);
}
