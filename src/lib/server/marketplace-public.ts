import type {
  Conference,
  OrganizerAwardConfig,
  OrganizerConferencePartnerLink,
  OrganizerDocument,
  OrganizerPreviousEdition,
  OrganizerTeamMember,
  PublicConferenceDetail,
  RegistrationCategory,
} from "@/lib/types";
import type { CommitteeConfig, Event, OrganizerConferenceConfig, Portfolio, PricingPhaseConfig, User } from "@/generated/prisma/client";
import { moneyNumber } from "@/lib/server/decimal-money";
import { decodeOrganizerDescription } from "@/lib/server/organizer-description";
import { decodeOrganizerStoredBlobRecord } from "@/lib/server/organizer-blob-decode";
import { coerceDate } from "@/lib/server/coerce-date";
import {
  isConferenceRegistrationOpen,
  resolveConferenceStatusBadge,
  resolveRegistrationDeadlineDay,
} from "@/lib/conference-status";
import { getPhaseStatus } from "@/lib/pricing";

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

function formatDate(d: Date | string): string {
  return coerceDate(d).toLocaleDateString("en-US", {
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
  event: Pick<Event, "endDate">,
  blob: Record<string, unknown> | null
): NonNullable<Conference["statusBadgeLabel"]> {
  const categories = Array.isArray(blob?.registrationCategories)
    ? (blob!.registrationCategories as RegistrationCategory[])
    : [];

  return resolveConferenceStatusBadge({
    endDate: event.endDate,
    registrationDeadline: blobString(blob, "registrationDeadline"),
    categories,
  });
}

export type EventWithListing = Event & {
  organizerConfig:
    | (Omit<OrganizerConferenceConfig, "description"> & {
        description?: string | null;
        committees: Array<CommitteeConfig & { portfolios?: Portfolio[] }>;
        pricingPhases: PricingPhaseConfig[];
      })
    | null;
  owner: Pick<User, "name" | "email"> | null;
  _count: { registrations: number };
  registrations?: Array<{ committeeName: string | null; portfolioName: string | null }>;
};

function parseChairsJson(raw: string | null | undefined): Array<{ id: string; name: string; email?: string; role?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry, index) => ({
        id: String(entry.id || `chair-${index}`),
        name: String(entry.name || ""),
        email: entry.email ? String(entry.email) : undefined,
        role: entry.role ? String(entry.role) : undefined,
      }))
      .filter((chair) => chair.name);
  } catch {
    return [];
  }
}

function parseAgendasJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function allotmentCountsByCommitteeName(
  registrations: Array<{ committeeName: string | null }> | undefined
): Map<string, number> {
  const map = new Map<string, number>();
  for (const reg of registrations ?? []) {
    const name = reg.committeeName?.trim();
    if (!name) continue;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return map;
}

/** Portfolio name -> taken, keyed by "committeeName::portfolioName" (case-insensitive). */
function takenPortfolioKeys(
  registrations: Array<{ committeeName: string | null; portfolioName: string | null }> | undefined
): Set<string> {
  const set = new Set<string>();
  for (const reg of registrations ?? []) {
    const committee = reg.committeeName?.trim().toLowerCase();
    const portfolio = reg.portfolioName?.trim().toLowerCase();
    if (!committee || !portfolio) continue;
    set.add(`${committee}::${portfolio}`);
  }
  return set;
}

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
    const amountRaw = item.amount;
    const amount =
      typeof amountRaw === "number" && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : undefined;
    const participantName =
      typeof item.participantName === "string" && item.participantName.trim()
        ? item.participantName.trim()
        : undefined;
    awards.push({
      id: String(item.id || `award-${awards.length}`),
      category,
      prizeTitle: typeof item.prizeTitle === "string" ? item.prizeTitle : undefined,
      description: typeof item.description === "string" ? item.description : undefined,
      amount,
      participantName,
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
  const blobCategories = Array.isArray(blob?.registrationCategories)
    ? (blob!.registrationCategories as RegistrationCategory[])
    : [];
  const phasePrices = blobCategories.flatMap((category) =>
    category.applicationType === "chair"
      ? [0]
      : (category.pricingPhases || [])
          .map((phase) => Number(phase.basePrice))
          .filter((n) => Number.isFinite(n))
  );
  const categoryBasePrices = blobCategories
    .map((category) => category.applicationType === "chair" ? 0 : Number(category.basePrice))
    .filter((n) => Number.isFinite(n));
  const priceCandidates = [...committeePrices, ...phasePrices, ...categoryBasePrices];
  const price = priceCandidates.length > 0 ? Math.min(...priceCandidates) : 0;

  const allotmentByName = allotmentCountsByCommitteeName(event.registrations);
  const takenPortfolios = takenPortfolioKeys(event.registrations);
  const publicCommittees = committees.filter(
    (cm) => cm.visibility === "PUBLIC" || cm.visibility == null
  );
  const matrixVisibility = cfg?.portfolioMatrixVisibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";

  const capacity = publicCommittees.reduce((sum, c) => sum + c.seatCount, 0);
  const registered = event._count.registrations;

  const currency = event.currency?.trim() || "INR";

  const blobPhaseDates = blobCategories.flatMap((category) => category.pricingPhases || []);
  const earliestPhaseStart = blobPhaseDates
    .map((p) => coerceDate(p.startDate))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];

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
  const blobCommittees = Array.isArray(blob?.committees)
    ? (blob.committees as Array<{ id: string; documents?: OrganizerDocument[] }>)
    : [];
  const blobCommitteeById = new Map(blobCommittees.map((committee) => [committee.id, committee]));

  const registrationDeadlineDay = resolveRegistrationDeadlineDay({
    endDate: event.endDate,
    registrationDeadline: blobString(blob, "registrationDeadline"),
    categories: blobCategories,
  });

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
    registrationDeadline: registrationDeadlineDay
      ? formatDate(new Date(registrationDeadlineDay))
      : formatDate(event.endDate),
    price,
    currency,
    level,
    committees: publicCommittees.map((cm) => {
      const agendas = parseAgendasJson((cm as { agendasJson?: string | null }).agendasJson);
      const chairs = parseChairsJson((cm as { chairsJson?: string | null }).chairsJson);
      const noPortfolio = (cm as { noPortfolio?: boolean }).noPortfolio === true;
      const portfolios = noPortfolio
        ? []
        : (cm.portfolios ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            seatCount: p.seatCount,
            taken: matrixVisibility === "PUBLIC"
              ? takenPortfolios.has(`${cm.name.trim().toLowerCase()}::${p.name.trim().toLowerCase()}`)
              : undefined,
          }));
      return {
        id: cm.id,
        name: cm.name,
        abbreviation: cm.name.slice(0, 8).toUpperCase(),
        topic1: cm.agenda?.trim() || "Agenda to be announced",
        topic2: agendas[0] || "",
        agendas: [cm.agenda?.trim() || "Agenda to be announced", ...agendas].filter(Boolean),
        difficulty: "Intermediate" as const,
        size: cm.seatCount,
        allottedCount: allotmentByName.get(cm.name) ?? 0,
        logoImageUrl: (cm as { logoImageUrl?: string | null }).logoImageUrl ?? undefined,
        chairs: chairs.length > 0 ? chairs : undefined,
        documents: mergeCommitteeDocuments(
          (cm as CommitteeConfig & { documents?: Array<{ id: string; title: string; category: string; fileUrl: string }> })
            .documents,
          blobCommitteeById.get(cm.id)?.documents
        ),
        noPortfolio,
        portfolioMatrixVisibility: matrixVisibility,
        portfolios,
      };
    }),
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
        : publicCommittees.length > 0
          ? publicCommittees.slice(0, 3).map((c) => c.name)
          : ["Model UN", "Published"],
    statusBadgeLabel: statusBadge(event, blob),
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

function resolveDocumentUrl(item: Record<string, unknown>): string {
  const url = typeof item.url === "string" ? item.url.trim() : "";
  const fileUrl = typeof item.fileUrl === "string" ? item.fileUrl.trim() : "";
  return url || fileUrl;
}

function mergeCommitteeDocuments(
  dbDocs:
    | Array<{ id: string; title: string; category: string; fileUrl: string }>
    | undefined,
  blobDocs: OrganizerDocument[] | undefined
): Array<{ id: string; title: string; category: string; url: string }> {
  const merged: Array<{ id: string; title: string; category: string; url: string }> = [];
  const seen = new Set<string>();

  for (const doc of blobDocs ?? []) {
    const url = doc.url?.trim();
    if (!url || url === "#") continue;
    const key = `${doc.id}:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ id: doc.id, title: doc.title, category: doc.category, url });
  }

  for (const doc of dbDocs ?? []) {
    const url = doc.fileUrl?.trim();
    if (!url || url === "#") continue;
    const key = `${doc.id}:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ id: doc.id, title: doc.title, category: doc.category, url });
  }

  return merged;
}

function normalizeBlobDocuments(blob: Record<string, unknown> | null): OrganizerDocument[] | undefined {
  if (!Array.isArray(blob?.commonDocuments)) return undefined;
  const docs: OrganizerDocument[] = [];
  for (const entry of blob.commonDocuments as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const url = resolveDocumentUrl(item);
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

function normalizePartnerConferences(
  blob: Record<string, unknown> | null
): PublicConferenceDetail["partnerConferences"] {
  if (!Array.isArray(blob?.partnerLinks)) return undefined;
  const partners: NonNullable<PublicConferenceDetail["partnerConferences"]> = [];
  for (const entry of blob.partnerLinks as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const link = entry as OrganizerConferencePartnerLink;
    if (link.status !== "ACCEPTED") continue;
    const id = String(link.partnerConferenceId || "").trim();
    if (!id) continue;
    partners.push({
      id,
      title: String(link.partnerConferenceTitle || "Partner MUN").trim(),
      status: link.status,
    });
  }
  return partners.length > 0 ? partners : undefined;
}

function computeRegistrationOpen(
  blob: Record<string, unknown> | null,
  eventEndDate: Date | string
): boolean {
  const categories = Array.isArray(blob?.registrationCategories)
    ? (blob!.registrationCategories as RegistrationCategory[])
    : [];

  return isConferenceRegistrationOpen({
    endDate: eventEndDate,
    registrationDeadline: blobString(blob, "registrationDeadline"),
    categories,
  });
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
    socialLinks: (() => {
      const pick = (key: "website" | "instagram" | "linkedin" | "twitter") => {
        const fromBlob =
          socialRaw && typeof socialRaw[key] === "string" ? String(socialRaw[key]).trim() : "";
        if (fromBlob) return fromBlob;
        const cfg = event.organizerConfig;
        if (key === "website") return cfg?.websiteUrl?.trim() || undefined;
        if (key === "instagram") return cfg?.instagramUrl?.trim() || undefined;
        if (key === "linkedin") return cfg?.linkedinUrl?.trim() || undefined;
        return cfg?.twitterUrl?.trim() || undefined;
      };
      return {
        website: pick("website"),
        instagram: pick("instagram"),
        linkedin: pick("linkedin"),
        twitter: pick("twitter"),
      };
    })(),
    commonDocuments: normalizeBlobDocuments(blob),
    awards: normalizeBlobAwards(blob),
    previousEditions: normalizeBlobPreviousEditions(blob),
    partnerConferences: normalizePartnerConferences(blob),
    reviews: options?.approvedReviews?.length ? options.approvedReviews : undefined,
    registrationOpen: computeRegistrationOpen(blob, event.endDate),
    hasDelegationRegistration: Array.isArray(blob?.registrationCategories)
      ? (blob!.registrationCategories as RegistrationCategory[]).some(
          (category) => category.applicationType === "delegation" && category.isOpen !== false
        )
      : false,
    ...computePublicPricingPhaseSummary(blob),
    allocationMode:
      event.organizerConfig?.allocationMode === "PAY_FIRST" ||
      event.organizerConfig?.allocationMode === "ALLOT_FIRST"
        ? event.organizerConfig.allocationMode
        : undefined,
    organizerTeam: normalizePublicTeam(blob),
    hiddenSections: Array.isArray(blob?.hiddenSections)
      ? (blob!.hiddenSections as unknown[]).map((entry) => String(entry)).filter(Boolean)
      : undefined,
  };
}

function computePublicPricingPhaseSummary(blob: Record<string, unknown> | null): {
  pricingPhaseChips?: PublicConferenceDetail["pricingPhaseChips"];
  activePricingPhaseName?: string;
} {
  const categories = Array.isArray(blob?.registrationCategories)
    ? (blob!.registrationCategories as RegistrationCategory[])
    : [];
  const chips: NonNullable<PublicConferenceDetail["pricingPhaseChips"]> = [];
  let activePricingPhaseName: string | undefined;
  for (const category of categories) {
    if (category.isOpen === false) continue;
    for (const phase of category.pricingPhases || []) {
      const status = getPhaseStatus(phase, new Date());
      chips.push({
        id: `${category.id}-${phase.id}`,
        name: phase.name,
        status: status === "Active" || status === "Upcoming" || status === "Ended" ? status : "Ended",
      });
      if (status === "Active" && !activePricingPhaseName) {
        activePricingPhaseName = phase.name;
      }
    }
  }
  return {
    pricingPhaseChips: chips.length > 0 ? chips : undefined,
    activePricingPhaseName,
  };
}

function normalizePublicTeam(blob: Record<string, unknown> | null): PublicConferenceDetail["organizerTeam"] {
  if (!blob || !Array.isArray(blob.organizerTeam)) return undefined;
  const members = blob.organizerTeam
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return null;
      return {
        id: typeof row.id === "string" ? row.id : `team-${name}`,
        name,
        email: "",
        role: typeof row.role === "string" ? row.role : "Team",
        teamType: row.teamType === "secretariat" ? "secretariat" as const : "organizer" as const,
        permissions: Array.isArray(row.permissions)
          ? (row.permissions as OrganizerTeamMember["permissions"])
          : (["view"] as OrganizerTeamMember["permissions"]),
        photoUrl: typeof row.photoUrl === "string" ? row.photoUrl : undefined,
      };
    })
    .filter(Boolean) as NonNullable<PublicConferenceDetail["organizerTeam"]>;
  return members.length > 0 ? members : undefined;
}
