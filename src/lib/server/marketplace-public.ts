import type {
  Conference,
  OrganizerAwardConfig,
  OrganizerDocument,
  OrganizerPreviousEdition,
  PublicConferenceDetail,
} from "@/lib/types";
import type { CommitteeConfig, Event, OrganizerConferenceConfig, PricingPhaseConfig, User } from "@/generated/prisma/client";
import { moneyNumber } from "@/lib/server/decimal-money";
import { decodeOrganizerDescription } from "@/lib/server/organizer-description";
import { decodeOrganizerStoredBlobRecord } from "@/lib/server/organizer-blob-decode";

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
  organizerConfig:
    | (Omit<OrganizerConferenceConfig, "description"> & {
        description?: string | null;
        committees: CommitteeConfig[];
        pricingPhases: PricingPhaseConfig[];
      })
    | null;
  owner: Pick<User, "name" | "email"> | null;
  _count: { registrations: number };
};

function blobString(blob: Record<string, unknown> | null, key: string): string | undefined {
  const value = blob?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeBlobAwards(blob: Record<string, unknown> | null): OrganizerAwardConfig[] | undefined {
  if (!Array.isArray(blob?.awards)) return undefined;
  const awards: OrganizerAwardConfig[] = [];
  for (const entry of blob.awards as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const category = typeof item.category === "string" ? item.category.trim() : "";
    if (!category) continue;
    awards.push({
      id: String(item.id || `award-${awards.length}`),
      category,
      prizeTitle: typeof item.prizeTitle === "string" ? item.prizeTitle : undefined,
      description: typeof item.description === "string" ? item.description : undefined,
    });
  }
  return awards.length > 0 ? awards : undefined;
}

function normalizeBlobPreviousEditions(
  blob: Record<string, unknown> | null
): OrganizerPreviousEdition[] | undefined {
  if (!Array.isArray(blob?.previousEditions)) return undefined;
  const editions: OrganizerPreviousEdition[] = [];
  for (const entry of blob.previousEditions as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const year = typeof item.year === "string" ? item.year.trim() : String(item.year ?? "").trim();
    if (!title || !year) continue;
    const delegatesRaw = item.delegates;
    const delegates =
      typeof delegatesRaw === "number"
        ? delegatesRaw
        : typeof delegatesRaw === "string"
          ? Number(delegatesRaw)
          : 0;
    editions.push({
      id: String(item.id || `edition-${editions.length}`),
      year,
      title,
      delegates: Number.isFinite(delegates) && delegates >= 0 ? Math.floor(delegates) : 0,
      highlights: typeof item.highlights === "string" ? item.highlights : undefined,
    });
  }
  return editions.length > 0 ? editions : undefined;
}

export function mapPublishedEventToConference(event: EventWithListing): Conference {
  const cfg = event.organizerConfig;
  const blob = decodeOrganizerStoredBlobRecord(cfg?.description);
  const description =
    blobString(blob, "description") ?? decodeOrganizerDescription(cfg?.description);
  const committees = cfg?.committees ?? [];
  const phases = cfg?.pricingPhases ?? [];
  const parsedVenue = parseVenue(cfg?.venue);
  const city = blobString(blob, "city") ?? parsedVenue.city;
  const country = blobString(blob, "country") ?? parsedVenue.country;
  const location =
    blobString(blob, "venue") ??
    (parsedVenue.location !== "Venue TBA"
      ? parsedVenue.location
      : [city, country].filter((part) => part && part !== "—").join(", ") || "Venue TBA");
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
  const blobLevel = blob?.level;
  const level =
    blobLevel === "High School" ||
    blobLevel === "University" ||
    blobLevel === "Open" ||
    blobLevel === "Elite" ||
    blobLevel === "Hybrid"
      ? blobLevel
      : "Open";
  const blobTags = Array.isArray(blob?.tags)
    ? (blob.tags as unknown[]).map((entry) => String(entry).trim()).filter(Boolean)
    : [];

  return {
    id: event.id,
    title: blobString(blob, "title") ?? event.title,
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
    level,
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
    description: description || "Details will be posted by the organizer.",
    organizer: blobString(blob, "organizerName") || event.owner?.name?.trim() || "Organizer",
    organizerEmail: event.owner?.email?.trim() || "",
    website:
      (typeof blob?.socialLinks === "object" &&
      blob.socialLinks !== null &&
      !Array.isArray(blob.socialLinks) &&
      typeof (blob.socialLinks as Record<string, unknown>).website === "string"
        ? String((blob.socialLinks as Record<string, unknown>).website).trim()
        : undefined) ||
      cfg?.websiteUrl?.trim() ||
      "#",
    featured: false,
    color: "from-slate-700 to-slate-900",
    logoImageUrl: blobString(blob, "logoImageUrl") ?? cfg?.logoImageUrl ?? undefined,
    bannerImageUrl:
      blobString(blob, "bannerImageUrl") ?? event.coverImageUrl ?? cfg?.bannerImageUrl ?? undefined,
    tags:
      blobTags.length > 0
        ? blobTags
        : committees.length > 0
          ? committees.slice(0, 3).map((c) => c.name)
          : ["Model UN", "Published"],
    statusBadgeLabel: statusBadge(event.endDate, committees, phases),
  };
}

export type PublicReviewRow = {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  featured?: boolean;
  createdAt?: string;
};

function normalizeBlobDocuments(blob: Record<string, unknown> | null): OrganizerDocument[] | undefined {
  if (!Array.isArray(blob?.commonDocuments)) return undefined;
  const docs: OrganizerDocument[] = [];
  for (const entry of blob.commonDocuments as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!url || url === "#") continue;
    docs.push({
      id: String(item.id || `doc-${docs.length}`),
      title: String(item.title || "Document"),
      category:
        item.category === "background-guide" ||
        item.category === "guidelines" ||
        item.category === "rules" ||
        item.category === "other"
          ? item.category
          : "other",
      sourceType: item.sourceType === "upload" ? "upload" : "url",
      url,
      fileName: typeof item.fileName === "string" ? item.fileName : undefined,
      mimeType: typeof item.mimeType === "string" ? item.mimeType : undefined,
    });
  }
  return docs.length > 0 ? docs : undefined;
}

export function mapPublishedEventToPublicDetail(
  event: EventWithListing,
  options?: { approvedReviews?: PublicReviewRow[] }
): PublicConferenceDetail {
  const base = mapPublishedEventToConference(event);
  const blob = decodeOrganizerStoredBlobRecord(event.organizerConfig?.description);
  const socialRaw =
    blob && typeof blob.socialLinks === "object" && blob.socialLinks !== null && !Array.isArray(blob.socialLinks)
      ? (blob.socialLinks as Record<string, unknown>)
      : null;

  return {
    ...base,
    whatIsIncluded: Array.isArray(blob?.whatIsIncluded)
      ? (blob.whatIsIncluded as unknown[]).map((entry) => String(entry).trim()).filter(Boolean)
      : undefined,
    conferenceSchedule: Array.isArray(blob?.conferenceSchedule)
      ? (blob.conferenceSchedule as PublicConferenceDetail["conferenceSchedule"])
      : undefined,
    termsAndConditions: blobString(blob, "termsAndConditions"),
    refundPolicy: blobString(blob, "refundPolicy"),
    codeOfConduct: blobString(blob, "codeOfConduct"),
    faqNotes: blobString(blob, "faqNotes"),
    organizerName: blobString(blob, "organizerName"),
    socialLinks: socialRaw
      ? {
          website: typeof socialRaw.website === "string" ? socialRaw.website : undefined,
          instagram: typeof socialRaw.instagram === "string" ? socialRaw.instagram : undefined,
          linkedin: typeof socialRaw.linkedin === "string" ? socialRaw.linkedin : undefined,
          twitter: typeof socialRaw.twitter === "string" ? socialRaw.twitter : undefined,
        }
      : {
          website: event.organizerConfig?.websiteUrl ?? undefined,
          instagram: event.organizerConfig?.instagramUrl ?? undefined,
          linkedin: event.organizerConfig?.linkedinUrl ?? undefined,
          twitter: event.organizerConfig?.twitterUrl ?? undefined,
        },
    commonDocuments: normalizeBlobDocuments(blob),
    awards: normalizeBlobAwards(blob),
    previousEditions: normalizeBlobPreviousEditions(blob),
    reviews: options?.approvedReviews?.length ? options.approvedReviews : undefined,
  };
}
