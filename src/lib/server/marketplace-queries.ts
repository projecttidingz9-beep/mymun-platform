import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/server/prisma";

export const MARKETPLACE_CACHE_TAG = "marketplace";

/** Catalog listing: omit description blob and heavy committee/portfolio graphs — detail route loads them. */
const catalogOrganizerConfigSelect = {
  id: true,
  venue: true,
  websiteUrl: true,
  logoImageUrl: true,
  bannerImageUrl: true,
  instagramUrl: true,
  linkedinUrl: true,
  twitterUrl: true,
  portfolioMatrixVisibility: true,
  committees: {
    select: {
      id: true,
      name: true,
      seatCount: true,
      basePrice: true,
      visibility: true,
    },
  },
} as const;

export async function fetchPublishedCatalogEvents() {
  return prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      startDate: true,
      endDate: true,
      currency: true,
      coverImageUrl: true,
      status: true,
      timezone: true,
      ownerUserId: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      organizerConfig: {
        select: catalogOrganizerConfigSelect,
      },
      owner: { select: { name: true, email: true } },
      _count: {
        select: {
          registrations: {
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: { startDate: "asc" },
    take: 200,
  });
}

export async function fetchPublishedEventDetail(eventKey: string) {
  return prisma.event.findFirst({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      OR: [{ id: eventKey }, { slug: eventKey }],
    },
    include: {
      organizerConfig: {
        include: {
          committees: { include: { portfolios: true } },
          pricingPhases: true,
        },
      },
      owner: { select: { name: true, email: true } },
      reviews: {
        where: { status: "approved" },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: {
        select: {
          registrations: {
            where: { deletedAt: null },
          },
        },
      },
      registrations: {
        where: { deletedAt: null, status: "ALLOTTED" },
        select: { committeeName: true, portfolioName: true },
      },
    },
  });
}

export const getCachedPublishedCatalog = unstable_cache(
  fetchPublishedCatalogEvents,
  ["marketplace-catalog"],
  { revalidate: 60, tags: [MARKETPLACE_CACHE_TAG] }
);

export function getCachedPublishedEventDetail(eventKey: string) {
  return unstable_cache(
    () => fetchPublishedEventDetail(eventKey),
    ["marketplace-detail", eventKey],
    { revalidate: 30, tags: [MARKETPLACE_CACHE_TAG] }
  )();
}
