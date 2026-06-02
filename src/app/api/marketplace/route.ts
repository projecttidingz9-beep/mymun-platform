import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { mapPublishedEventToConference } from "@/lib/server/marketplace-public";

/** Public catalog: published events only (no client/local demo data). */
export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
      },
      include: {
        organizerConfig: {
          include: {
            committees: true,
            pricingPhases: true,
          },
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

    const conferences = events.map(mapPublishedEventToConference);

    return NextResponse.json(
      { conferences },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    console.error("[marketplace]", e);
    return NextResponse.json({ conferences: [], error: "Catalog unavailable." }, { status: 503 });
  }
}
