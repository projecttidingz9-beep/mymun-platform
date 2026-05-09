import { Conference, OrganizerConference } from "@/lib/types";
import { getActivePhase } from "@/lib/pricing";

const LISTABLE_ORGANIZER_STATUSES = new Set<OrganizerConference["status"]>([
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

function parseDayStart(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).setHours(0, 0, 0, 0);
  return Number.isNaN(parsed) ? null : parsed;
}

function getConferenceStatusBadge(conference: OrganizerConference): string {
  const today = new Date().setHours(0, 0, 0, 0);
  const eventEnd = parseDayStart(conference.endDate);
  if (eventEnd !== null && eventEnd < today) return "Event Ended";

  const openCategories = conference.registrationCategories.filter((category) => category.isOpen !== false);
  const hasActivePhase = openCategories.some((category) => Boolean(getActivePhase(category.pricingPhases)));
  if (hasActivePhase) return "Register Now";

  const allPhaseWindows = openCategories.flatMap((category) => category.pricingPhases || []);
  const hasUpcomingPhase = allPhaseWindows.some((phase) => {
    const start = parseDayStart(phase.startDate);
    return start !== null && start > today;
  });
  const hasEndedPhase = allPhaseWindows.some((phase) => {
    const end = parseDayStart(phase.endDate);
    return end !== null && end < today;
  });

  if (hasUpcomingPhase && !hasEndedPhase) return "Coming Soon";
  if (hasUpcomingPhase && hasEndedPhase) return "Currently Registrations Closed";
  if (openCategories.length === 0) return "Currently Registrations Closed";

  const registrationDeadline = parseDayStart(conference.registrationDeadline);
  if (registrationDeadline !== null && registrationDeadline >= today) {
    return "Register Now";
  }
  return "Currently Registrations Closed";
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
  const registrationOpenDate = openCategories
    .flatMap((category) => category.pricingPhases || [])
    .map((phase) => phase.startDate)
    .sort((a, b) => (parseDayStart(a) ?? Number.MAX_SAFE_INTEGER) - (parseDayStart(b) ?? Number.MAX_SAFE_INTEGER))[0];

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
    registrationOpenDate: formatDate(registrationOpenDate),
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
    organizerEmail: conference.contactDetail?.trim() || "",
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
  return organizerConferences
    .filter((conference) => LISTABLE_ORGANIZER_STATUSES.has(conference.status))
    .map(mapOrganizerConferenceToMarketplaceConference);
}
