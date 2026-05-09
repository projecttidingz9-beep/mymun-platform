import { NextRequest, NextResponse } from "next/server";
import { getRequestActor, requireEventOrganizerAccess } from "@/lib/server/auth";
import { upsertRegistrationFromClient } from "@/lib/server/registration-sync";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const eventId = String(body.eventId || "");
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }
    if (!(await requireEventOrganizerAccess(actor, eventId))) {
      return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
    }
    const registration = await upsertRegistrationFromClient({
      registrationId: body.registrationId,
      eventId,
      eventTitle: body.eventTitle,
      eventStartDateIso: body.eventStartDateIso,
      eventEndDateIso: body.eventEndDateIso,
      userEmail: body.userEmail,
      userName: body.userName,
      categoryName: body.categoryName,
      committeeName: body.committeeName,
      portfolioName: body.portfolioName,
      amount: Number(body.amount ?? 0),
      paid: Boolean(body.paid),
      organizerStatus: body.organizerStatus,
    });
    return NextResponse.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync registration.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
