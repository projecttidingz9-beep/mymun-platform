import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess } from "@/lib/server/auth";
import { logger } from "@/lib/server/logger";
import { upsertRegistrationFromClient } from "@/lib/server/registration-sync";
import { registrationSyncBodySchema } from "@/lib/server/validators/registration";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = registrationSyncBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;
    if (!(await requireEventOrganizerAccess(actor, body.eventId))) {
      return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
    }
    const registration = await upsertRegistrationFromClient({
      registrationId: body.registrationId,
      eventId: body.eventId,
      eventTitle: body.eventTitle,
      eventStartDateIso: body.eventStartDateIso,
      eventEndDateIso: body.eventEndDateIso,
      userEmail: body.userEmail,
      userName: body.userName,
      categoryName: body.categoryName,
      committeeName: body.committeeName,
      portfolioName: body.portfolioName,
      amount: body.amount,
      paid: body.paid,
      organizerStatus: body.organizerStatus,
    });
    return NextResponse.json({ registration });
  } catch (error) {
    logger.error("registration_sync_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to sync registration." }, { status: 500 });
  }
}
