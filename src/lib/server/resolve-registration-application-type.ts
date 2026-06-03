import {
  getCategoryRegistrationLabel,
  normalizeCategoryApplicationType,
  type RegistrationCategoryType,
} from "@/lib/registration-category-types";
import type { RegistrationCategory } from "@/lib/types";
import { getOrganizerStoredBlob } from "@/lib/server/organizer-config-store";

const CATEGORY_TYPES: RegistrationCategoryType[] = [
  "delegate",
  "chair",
  "delegation",
  "organizer",
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
  if (normalized.includes("organiz")) return "organizer";
  if (normalized.includes("delegation")) return "delegation";
  if (normalized.includes("delegate")) return "delegate";

  return "other";
}

export async function resolveRegistrationApplicationType(
  eventId: string,
  categoryName: string
): Promise<RegistrationCategoryType> {
  const blob = await getOrganizerStoredBlob(eventId);
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
