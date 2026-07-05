import { NextResponse } from "next/server";
import { mapPublishedEventToConference, type EventWithListing } from "@/lib/server/marketplace-public";
import { getCachedPublishedCatalog } from "@/lib/server/marketplace-queries";
import { MARKETPLACE_CATALOG_CACHE_CONTROL } from "@/lib/server/http-cache";

/** Public catalog: published events only (no client/local demo data). */
export async function GET() {
  try {
    let events;
    try {
      events = await getCachedPublishedCatalog();
    } catch (cacheError) {
      console.warn("[marketplace] cache miss — fetching catalog without unstable_cache", cacheError);
      const { fetchPublishedCatalogEvents } = await import("@/lib/server/marketplace-queries");
      events = await fetchPublishedCatalogEvents();
    }
    const conferences = events.map((event) => {
      const full = mapPublishedEventToConference(event as EventWithListing);
      const description = typeof full.description === "string" ? full.description : "";
      // Slim list payload: cards only need summary fields, not full portfolio matrices.
      return {
        ...full,
        description: description.length > 220 ? `${description.slice(0, 220)}…` : description,
        committees: (full.committees || []).map((committee) => ({
          id: committee.id,
          name: committee.name,
          abbreviation: committee.abbreviation,
          topic1: "",
          topic2: "",
          difficulty: committee.difficulty,
          size: committee.size,
          allottedCount: committee.allottedCount,
        })),
      };
    });

    return NextResponse.json(
      { conferences },
      {
        headers: {
          "Cache-Control": MARKETPLACE_CATALOG_CACHE_CONTROL,
        },
      }
    );
  } catch (e) {
    console.error("[marketplace]", e);
    return NextResponse.json({ conferences: [], error: "Catalog unavailable." }, { status: 503 });
  }
}
