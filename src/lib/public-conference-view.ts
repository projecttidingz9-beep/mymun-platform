import type {
  Conference,
  OrganizerAwardConfig,
  OrganizerConference,
  OrganizerDocument,
  OrganizerPreviousEdition,
  PublicConferenceDetail,
} from "@/lib/types";
import { mapOrganizerConferenceToMarketplaceConference } from "@/lib/marketplace-conferences";
import { resolveConferenceScheduleDisplayDays, type ConferenceScheduleDisplayDay } from "@/lib/conference-schedule";

const PREVIEW_JSON_PREFIX = "__preview_json__:";

export function sanitizeConferenceDescription(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed.startsWith(PREVIEW_JSON_PREFIX)) return trimmed;
  try {
    const parsed = JSON.parse(trimmed.slice(PREVIEW_JSON_PREFIX.length)) as Record<string, unknown>;
    return typeof parsed.description === "string" ? parsed.description.trim() : "";
  } catch {
    return "";
  }
}

export type PolicySection = { key: string; label: string; value: string };

export type ResolvedPublicConferenceView = {
  /** Conference record used for hero, pricing shell, and committee list shape. */
  conference: Conference;
  /** True when marketplace API/catalog should drive visible content (published). */
  useServerPublicContent: boolean;
  displayTitle: string;
  displayOrganizerName: string;
  displayDescription: string;
  safeDisplayDescription: string;
  displayLocation: string;
  displayWebsite: string;
  displayInstagram?: string;
  displayLinkedin?: string;
  displayTwitter?: string;
  displayTags: string[];
  displayWhatsIncluded: string[];
  scheduleGroups: ConferenceScheduleDisplayDay[];
  policySections: PolicySection[];
  commonDocuments: Array<OrganizerDocument & { sourceConferenceTitle: string }>;
  overviewAwardLines: string[];
  previousEditions: OrganizerPreviousEdition[];
  heroLogoImage?: string;
  /** Organizer-only operational overlay (seat counts, merged partners). */
  hasOrganizerOperationalOverlay: boolean;
};

function awardLinesFromConfig(awards: OrganizerAwardConfig[] | undefined): string[] {
  if (!awards?.length) return [];
  return awards.map((award) => `${award.category}: ${award.prizeTitle || "Award"}`);
}

function resolveOrganizerDraftView(
  organizerConference: OrganizerConference,
  mergedOrganizerConferences: OrganizerConference[],
  scheduleFallback: ConferenceScheduleDisplayDay[]
): ResolvedPublicConferenceView {
  const conference = mapOrganizerConferenceToMarketplaceConference(organizerConference);
  const mergedTitles = mergedOrganizerConferences.map((entry) => entry.title).join(" x ");
  const displayDescription = mergedOrganizerConferences
    .map((entry) => entry.description)
    .filter(Boolean)
    .join("\n\n");
  const displayLocation = mergedOrganizerConferences
    .map((entry) => entry.venue || `${entry.city}, ${entry.country}`)
    .join(" | ");

  return {
    conference,
    useServerPublicContent: false,
    displayTitle: mergedTitles || conference.title,
    displayOrganizerName: organizerConference.organizerName,
    displayDescription,
    safeDisplayDescription:
      sanitizeConferenceDescription(displayDescription) ||
      "Conference details will be updated soon.",
    displayLocation,
    displayWebsite: organizerConference.socialLinks?.website || conference.website,
    displayInstagram: organizerConference.socialLinks?.instagram,
    displayLinkedin: organizerConference.socialLinks?.linkedin,
    displayTwitter: organizerConference.socialLinks?.twitter,
    displayTags: conference.tags,
    displayWhatsIncluded: organizerConference.whatIsIncluded || [],
    scheduleGroups: resolveConferenceScheduleDisplayDays({
      organizerSchedule: organizerConference.conferenceSchedule,
      fallback: scheduleFallback,
    }),
    policySections: [
      { key: "terms", label: "Terms and Conditions", value: organizerConference.termsAndConditions || "" },
      { key: "refund", label: "Refund / Cancellation Policy", value: organizerConference.refundPolicy || "" },
      { key: "conduct", label: "Code of Conduct", value: organizerConference.codeOfConduct || "" },
      { key: "faq", label: "FAQ / Additional Notes", value: organizerConference.faqNotes || "" },
    ].filter((entry) => entry.value.trim().length > 0),
    commonDocuments: mergedOrganizerConferences.flatMap((entry) =>
      (entry.commonDocuments || []).map((document) => ({
        ...document,
        sourceConferenceTitle: entry.title,
      }))
    ),
    overviewAwardLines: awardLinesFromConfig(organizerConference.awards),
    previousEditions: organizerConference.previousEditions || [],
    heroLogoImage: organizerConference.logoImageUrl || conference.logoImageUrl,
    hasOrganizerOperationalOverlay: true,
  };
}

function resolvePublishedServerView(
  catalog: Conference,
  publicDetail: PublicConferenceDetail | null | undefined,
  organizerConference: OrganizerConference | undefined,
  scheduleFallback: ConferenceScheduleDisplayDay[]
): ResolvedPublicConferenceView {
  const detail = publicDetail ?? catalog;
  const displayDescription = detail.description || catalog.description;
  const awardLines =
    awardLinesFromConfig(publicDetail?.awards) ||
    awardLinesFromConfig(organizerConference?.awards);

  return {
    conference: catalog,
    useServerPublicContent: true,
    displayTitle: catalog.title,
    displayOrganizerName: publicDetail?.organizerName || catalog.organizer,
    displayDescription,
    safeDisplayDescription:
      sanitizeConferenceDescription(displayDescription) ||
      "Conference details will be updated soon.",
    displayLocation: catalog.location,
    displayWebsite:
      publicDetail?.socialLinks?.website || organizerConference?.socialLinks?.website || catalog.website,
    displayInstagram: publicDetail?.socialLinks?.instagram || organizerConference?.socialLinks?.instagram,
    displayLinkedin: publicDetail?.socialLinks?.linkedin || organizerConference?.socialLinks?.linkedin,
    displayTwitter: publicDetail?.socialLinks?.twitter || organizerConference?.socialLinks?.twitter,
    displayTags: catalog.tags,
    displayWhatsIncluded:
      publicDetail?.whatIsIncluded && publicDetail.whatIsIncluded.length > 0
        ? publicDetail.whatIsIncluded
        : organizerConference?.whatIsIncluded || [],
    scheduleGroups: resolveConferenceScheduleDisplayDays({
      publicSchedule: publicDetail?.conferenceSchedule,
      organizerSchedule: organizerConference?.conferenceSchedule,
      fallback: scheduleFallback,
    }),
    policySections: [
      { key: "terms", label: "Terms and Conditions", value: publicDetail?.termsAndConditions || "" },
      { key: "refund", label: "Refund / Cancellation Policy", value: publicDetail?.refundPolicy || "" },
      { key: "conduct", label: "Code of Conduct", value: publicDetail?.codeOfConduct || "" },
      { key: "faq", label: "FAQ / Additional Notes", value: publicDetail?.faqNotes || "" },
    ].filter((entry) => entry.value.trim().length > 0),
    commonDocuments: (publicDetail?.commonDocuments || []).map((document) => ({
      ...document,
      sourceConferenceTitle: catalog.title,
    })),
    overviewAwardLines: awardLines,
    previousEditions: publicDetail?.previousEditions || organizerConference?.previousEditions || [],
    heroLogoImage: catalog.logoImageUrl || organizerConference?.logoImageUrl,
    hasOrganizerOperationalOverlay: Boolean(organizerConference),
  };
}

export function resolvePublishedConferenceDisplay(input: {
  catalog: Conference | null | undefined;
  publicDetail: PublicConferenceDetail | null | undefined;
  organizerConference?: OrganizerConference;
  mergedOrganizerConferences?: OrganizerConference[];
  scheduleFallback?: ConferenceScheduleDisplayDay[];
}): ResolvedPublicConferenceView | null {
  const scheduleFallback = input.scheduleFallback ?? [];
  const { catalog, publicDetail, organizerConference } = input;
  const mergedOrganizerConferences = input.mergedOrganizerConferences?.length
    ? input.mergedOrganizerConferences
    : organizerConference
      ? [organizerConference]
      : [];

  const isPublished =
    organizerConference?.status === "Published" || Boolean(publicDetail && catalog);
  const hasServerCatalog = Boolean(catalog);

  if (isPublished && hasServerCatalog && catalog) {
    return resolvePublishedServerView(catalog, publicDetail, organizerConference, scheduleFallback);
  }

  if (organizerConference) {
    return resolveOrganizerDraftView(organizerConference, mergedOrganizerConferences, scheduleFallback);
  }

  if (catalog) {
    return resolvePublishedServerView(catalog, publicDetail, undefined, scheduleFallback);
  }

  return null;
}
