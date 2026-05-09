import { Conference, OrganizerConference } from "@/lib/types";

export function resolveConferenceBannerImage(params: {
  conference: Conference;
  organizerConference?: OrganizerConference;
}): string | undefined {
  const raw = params.organizerConference?.bannerImageUrl || params.conference.bannerImageUrl;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
