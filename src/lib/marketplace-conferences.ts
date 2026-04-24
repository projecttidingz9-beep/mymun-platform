import { CONFERENCES } from "@/lib/data";
import { Conference, OrganizerConference } from "@/lib/types";

const LISTABLE_ORGANIZER_STATUSES = new Set<OrganizerConference["status"]>([
  "Review",
  "Published",
]);

const REGION_BY_COUNTRY: Record<string, Conference["region"]> = {
  india: "Asia",
  singapore: "Asia",
  japan: "Asia",
  china: "Asia",
  "south korea": "Asia",
  uk: "Europe",
  "united kingdom": "Europe",
  germany: "Europe",
  france: "Europe",
  austria: "Europe",
  canada: "Americas",
  usa: "Americas",
  "united states": "Americas",
  mexico: "Americas",
  brazil: "Americas",
  "south africa": "Africa",
  kenya: "Africa",
  nigeria: "Africa",
  australia: "Oceania",
  "new zealand": "Oceania",
};

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDate(dateValue: string | undefined): string {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function inferRegion(country: string): Conference["region"] {
  const normalized = country.trim().toLowerCase();
  return REGION_BY_COUNTRY[normalized] ?? "Asia";
}

export function mapOrganizerConferenceToMarketplaceConference(
  conference: OrganizerConference
): Conference {
  const openCategories = conference.registrationCategories.filter(
    (category) => category.isOpen !== false
  );
  const priceSource =
    openCategories.length > 0 ? openCategories : conference.registrationCategories;
  const startingPrice =
    priceSource.length > 0
      ? Math.min(...priceSource.map((category) => category.basePrice))
      : 0;
  const registrationDeadline =
    conference.registrationDeadline ||
    openCategories
      .map((category) => category.deadlineOverride)
      .find((deadline): deadline is string => Boolean(deadline)) ||
    conference.startDate;

  return {
    id: conference.id,
    title: conference.title,
    slug: toSlug(conference.title),
    location: conference.venue || `${conference.city}, ${conference.country}`,
    city: conference.city,
    country: conference.country,
    region: inferRegion(conference.country),
    startDate: formatDate(conference.startDate),
    endDate: formatDate(conference.endDate),
    registrationDeadline: formatDate(registrationDeadline),
    price: startingPrice,
    currency: "USD",
    level: conference.level,
    committees: conference.committees
      .filter((committee) => committee.isPublic !== false)
      .map((committee) => ({
        id: committee.id,
        name: committee.name,
        abbreviation: committee.name.slice(0, 8).toUpperCase(),
        topic1: committee.agenda || "Agenda to be announced",
        topic2:
          committee.customQuestions?.[0]?.question ||
          "Additional details by organizer",
        difficulty: "Intermediate" as const,
        size: committee.seatCount,
      })),
    capacity: conference.capacity,
    registered: conference.applicants.length,
    description:
      conference.description || "Conference details will be updated soon.",
    organizer: conference.organizerName,
    organizerEmail: "organizer@tidingz.local",
    website: conference.socialLinks?.website || "#",
    featured: false,
    color: "from-slate-700 to-slate-900",
    logoImageUrl: conference.logoImageUrl,
    bannerImageUrl: conference.bannerImageUrl,
    tags: [conference.level, conference.status, "Organizer Created"],
  };
}

export function getMarketplaceConferences(
  organizerConferences: OrganizerConference[]
): Conference[] {
  const organizerEntries = organizerConferences
    .filter((conference) => LISTABLE_ORGANIZER_STATUSES.has(conference.status))
    .map(mapOrganizerConferenceToMarketplaceConference);

  const merged = [...CONFERENCES, ...organizerEntries];
  const dedupedById = new Map<string, Conference>();
  for (const conference of merged) {
    dedupedById.set(conference.id, conference);
  }
  return Array.from(dedupedById.values());
}
