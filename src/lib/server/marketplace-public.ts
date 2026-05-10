import type { Conference } from "@/lib/types";
import type { CommitteeConfig, Event, OrganizerConferenceConfig, PricingPhaseConfig, User } from "@/generated/prisma/client";
import { moneyNumber } from "@/lib/server/decimal-money";

const REGION_BY_COUNTRY: Record<string, Conference["region"]> = {
  india: "Asia",
  singapore: "Asia",
  japan: "Asia",
  china: "Asia",
  "south korea": "Asia",
  bengaluru: "Asia",
  mumbai: "Asia",
  delhi: "Asia",
  uk: "Europe",
  "united kingdom": "Europe",
  germany: "Europe",
  france: "Europe",
  canada: "Americas",
  usa: "Americas",
  "united states": "Americas",
  australia: "Oceania",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function inferRegion(place: string): Conference["region"] {
  const normalized = place.trim().toLowerCase();
  return REGION_BY_COUNTRY[normalized] ?? "Asia";
}

function parseVenue(venue: string | null | undefined): { location: string; city: string; country: string } {
  const v = (venue || "").trim();
  if (!v) {
    return { location: "Venue TBA", city: "—", country: "—" };
  }
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[parts.length - 1] ?? "";
    const country = parts[parts.length - 2] ?? "";
    return { location: v, city, country };
  }
  return { location: v, city: parts[0] || "—", country: "—" };
}

function statusBadge(
  end: Date,
  committees: CommitteeConfig[],
  phases: PricingPhaseConfig[]
): NonNullable<Conference["statusBadgeLabel"]> {
  const today = new Date().setHours(0, 0, 0, 0);
  const endDay = new Date(end).setHours(0, 0, 0, 0);
  if (endDay < today) return "Event Ended";

  const capacity = committees.reduce((s, c) => s + c.seatCount, 0);
  if (capacity <= 0 && phases.length === 0) return "Coming Soon";

  const activePhase = phases.find((p) => {
    const s = new Date(p.startDate).setHours(0, 0, 0, 0);
    const e = new Date(p.endDate).setHours(0, 0, 0, 0);
    return today >= s && today <= e;
  });
  if (activePhase) return "Register Now";

  const upcoming = phases.some((p) => new Date(p.startDate).setHours(0, 0, 0, 0) > today);
  if (upcoming) return "Coming Soon";

  return "Currently Registrations Closed";
}

export type EventWithListing = Event & {
  organizerConfig: (OrganizerConferenceConfig & {
    committees: CommitteeConfig[];
    pricingPhases: PricingPhaseConfig[];
  }) | null;
  owner: Pick<User, "name" | "email"> | null;
  _count: { registrations: number };
};

export function mapPublishedEventToConference(event: EventWithListing): Conference {
  const cfg = event.organizerConfig;
  const committees = cfg?.committees ?? [];
  const phases = cfg?.pricingPhases ?? [];
  const { location, city, country } = parseVenue(cfg?.venue);
  const region = inferRegion(country) || inferRegion(city);

  const committeePrices = committees
    .map((c) => (c.basePrice == null ? null : moneyNumber(c.basePrice)))
    .filter((n): n is number => n != null && Number.isFinite(n));
  const phasePrices = phases.map((p) => moneyNumber(p.basePrice)).filter((n) => Number.isFinite(n));
  const priceCandidates = [...committeePrices, ...phasePrices];
  const price = priceCandidates.length > 0 ? Math.min(...priceCandidates) : 0;

  const capacity = committees.reduce((sum, c) => sum + c.seatCount, 0);
  const registered = event._count.registrations;

  const currency = event.currency?.trim() || "INR";

  const earliestPhaseStart = phases
    .map((p) => p.startDate)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const latestPhaseEnd = phases
    .map((p) => p.endDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const slug = event.slug?.trim() || toSlug(event.title);

  return {
    id: event.id,
    title: event.title,
    slug,
    location,
    city,
    country,
    region,
    startDate: formatDate(event.startDate),
    endDate: formatDate(event.endDate),
    registrationOpenDate: earliestPhaseStart ? formatDate(earliestPhaseStart) : formatDate(event.startDate),
    registrationDeadline: latestPhaseEnd ? formatDate(latestPhaseEnd) : formatDate(event.endDate),
    price,
    currency,
    level: "Open",
    committees: committees.map((cm) => ({
      id: cm.id,
      name: cm.name,
      abbreviation: cm.name.slice(0, 8).toUpperCase(),
      topic1: cm.agenda?.trim() || "Agenda to be announced",
      topic2: "",
      difficulty: "Intermediate" as const,
      size: cm.seatCount,
    })),
    capacity: capacity || Math.max(registered, 1),
    registered,
    description: cfg?.description?.trim() || "Details will be posted by the organizer.",
    organizer: event.owner?.name?.trim() || "Organizer",
    organizerEmail: event.owner?.email?.trim() || "",
    website: cfg?.websiteUrl?.trim() || "#",
    featured: false,
    color: "from-slate-700 to-slate-900",
    logoImageUrl: cfg?.logoImageUrl ?? undefined,
    bannerImageUrl: event.coverImageUrl ?? cfg?.bannerImageUrl ?? undefined,
    tags:
      committees.length > 0
        ? committees.slice(0, 3).map((c) => c.name)
        : ["Model UN", "Published"],
    statusBadgeLabel: statusBadge(event.endDate, committees, phases),
  };
}
