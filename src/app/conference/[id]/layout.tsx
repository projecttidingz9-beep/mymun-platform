import type { Metadata } from "next";
import { prisma } from "@/lib/server/prisma";

const site =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const event = await prisma.event.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id }, { slug: id }],
      },
      select: {
        title: true,
        startDate: true,
        endDate: true,
        coverImageUrl: true,
        organizerConfig: { select: { description: true, venue: true } },
      },
    });

    if (!event) {
      return {
        title: "Conference",
        description: "Discover Model UN conferences on Tidingz.",
      };
    }

    const desc =
      event.organizerConfig?.description?.trim() ||
      `${event.title} — ${event.organizerConfig?.venue || "MUN conference"} · ${event.startDate.toDateString()}`;

    const title = `${event.title} | Tidingz`;
    const url = `${site}/conference/${id}`;

    return {
      title,
      description: desc.slice(0, 160),
      alternates: { canonical: url },
      openGraph: {
        title,
        description: desc.slice(0, 200),
        url,
        siteName: "Tidingz",
        type: "website",
        images: event.coverImageUrl ? [{ url: event.coverImageUrl }] : [{ url: `${site}/tidingz-logo.jpg`, alt: "Tidingz" }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc.slice(0, 200),
        images: event.coverImageUrl ? [event.coverImageUrl] : [`${site}/tidingz-logo.jpg`],
      },
    };
  } catch {
    return {
      title: "Conference | Tidingz",
      description: "Conference details on Tidingz.",
    };
  }
}

export default function ConferenceSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
