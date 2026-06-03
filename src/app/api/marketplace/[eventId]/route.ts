import { NextRequest, NextResponse } from "next/server";
import { mapPublishedEventToPublicDetail } from "@/lib/server/marketplace-public";
import { getCachedPublishedEventDetail } from "@/lib/server/marketplace-queries";
import { MARKETPLACE_DETAIL_CACHE_CONTROL } from "@/lib/server/http-cache";

/** Public conference detail for delegates (published events only). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const params = await context.params;
  const eventKey = String(params.eventId || "").trim();
  if (!eventKey) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const event = await getCachedPublishedEventDetail(eventKey);

    if (!event) {
      return NextResponse.json({ error: "Conference not found." }, { status: 404 });
    }

    const approvedReviews = (event.reviews ?? []).map((review) => ({
      id: review.id,
      userName: review.user.name,
      rating: review.rating,
      comment: review.comment?.trim() || "",
      featured: review.featured,
      createdAt: review.createdAt.toISOString(),
    }));

    const conference = mapPublishedEventToPublicDetail(event, { approvedReviews });

    return NextResponse.json(
      { conference },
      {
        headers: {
          "Cache-Control": MARKETPLACE_DETAIL_CACHE_CONTROL,
        },
      }
    );
  } catch (e) {
    console.error("[marketplace/detail]", e);
    return NextResponse.json({ error: "Conference unavailable." }, { status: 503 });
  }
}
