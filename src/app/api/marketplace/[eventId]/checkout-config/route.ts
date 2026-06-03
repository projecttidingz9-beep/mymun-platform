import { NextRequest, NextResponse } from "next/server";
import { loadPublicCheckoutConfig } from "@/lib/server/load-public-checkout-config";
import { MARKETPLACE_DETAIL_CACHE_CONTROL } from "@/lib/server/http-cache";

/** Public registration categories and committees for delegate checkout. */
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
    const config = await loadPublicCheckoutConfig(eventKey);
    if (!config) {
      return NextResponse.json({ error: "Conference not found." }, { status: 404 });
    }

    return NextResponse.json(config, {
      headers: {
        "Cache-Control": MARKETPLACE_DETAIL_CACHE_CONTROL,
      },
    });
  } catch (e) {
    console.error("[marketplace/checkout-config]", e);
    return NextResponse.json({ error: "Checkout configuration unavailable." }, { status: 503 });
  }
}
