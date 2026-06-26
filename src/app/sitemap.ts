import type { MetadataRoute } from "next";
import { prisma } from "@/lib/server/prisma";
import { getSiteUrl } from "@/lib/site-url";

/** Avoid querying Prisma during `next build` when DB may be absent or out of date. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/about",
    "/contact",
    "/conferences",
    "/organizers",
    "/changelog",
    "/legal/privacy",
    "/legal/terms",
    "/legal/refund",
    "/legal/cookies",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  let events: MetadataRoute.Sitemap = [];
  try {
    const rows = await prisma.event.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { id: true, slug: true, updatedAt: true },
      take: 500,
    });
    events = rows.map((e) => ({
      url: `${base}/conference/${e.slug || e.id}`,
      lastModified: e.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable during static generation — skip dynamic URLs
  }

  return [...staticRoutes, ...events];
}
