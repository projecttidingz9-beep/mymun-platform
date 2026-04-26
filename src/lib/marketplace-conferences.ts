import { CONFERENCES } from "@/lib/data";
import { Conference, OrganizerConference } from "@/lib/types";
import { getActivePhase } from "@/lib/pricing";

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

function getConferenceStatusBadge(conference: OrganizerConference): string {
  const today = new Date().setHours(0, 0, 0, 0);
  const eventEnd = new Date(conference.endDate).setHours(0, 0, 0, 0);
  if (!Number.isNaN(eventEnd) && eventEnd < today) return "Event Ended";
  const activeCategoryPhase = conference.registrationCategories
    .map((category) => getActivePhase(category.pricingPhases))
    .find(Boolean);
  if (activeCategoryPhase?.name) {
    return `Phase ${activeCategoryPhase.name} Open`;
  }
  return "Coming Soon";
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
      .map((committee) => {
        const agendas = [
          committee.agenda || "Agenda to be announced",
          ...(committee.customQuestions?.map((question) => question.question) || []),
        ].filter((agenda) => agenda.trim().length > 0);
        return {
          id: committee.id,
          name: committee.name,
          abbreviation: committee.name.slice(0, 8).toUpperCase(),
          topic1: agendas[0] || "Agenda to be announced",
          topic2: agendas[1] || "",
          difficulty: "Intermediate" as const,
          size: committee.seatCount,
        };
      }),
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
    tags:
      conference.tags && conference.tags.length > 0
        ? conference.tags
        : [conference.level, conference.status, "Organizer Created"],
    statusBadgeLabel: getConferenceStatusBadge(conference),
  };
}

export function getMarketplaceConferences(
  organizerConferences: OrganizerConference[]
): Conference[] {
  const organizerEntries = organizerConferences
    .filter((conference) => LISTABLE_ORGANIZER_STATUSES.has(conference.status))
    .map(mapOrganizerConferenceToMarketplaceConference);

  const today = new Date().setHours(0, 0, 0, 0);
  const withStaticStatus = CONFERENCES.map((conference) => {
    if (conference.statusBadgeLabel) return conference;
    const end = new Date(conference.endDate).setHours(0, 0, 0, 0);
    const deadline = new Date(conference.registrationDeadline).setHours(0, 0, 0, 0);
    if (!Number.isNaN(end) && end < today) {
      return { ...conference, statusBadgeLabel: "Event Ended" };
    }
    if (!Number.isNaN(deadline) && deadline >= today) {
      return { ...conference, statusBadgeLabel: "Coming Soon" };
    }
    return { ...conference, statusBadgeLabel: "Coming Soon" };
  });

  const merged = [...withStaticStatus, ...organizerEntries];
  const dedupedById = new Map<string, Conference>();
  for (const conference of merged) {
    dedupedById.set(conference.id, conference);
  }
  return Array.from(dedupedById.values());
}
