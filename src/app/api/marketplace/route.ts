import { NextResponse } from "next/server";
import { mapPublishedEventToConference, type EventWithListing } from "@/lib/server/marketplace-public";
import { getCachedPublishedCatalog } from "@/lib/server/marketplace-queries";
import { MARKETPLACE_CATALOG_CACHE_CONTROL } from "@/lib/server/http-cache";

/** Public catalog: published events only (no client/local demo data). */
export async function GET() {
  try {
    const events = await getCachedPublishedCatalog();
    const conferences = events.map((event) =>
      mapPublishedEventToConference(event as EventWithListing)
    );

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
