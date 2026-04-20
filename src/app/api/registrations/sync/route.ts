import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { upsertRegistrationFromClient } from "@/lib/server/registration-sync";

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  try {
    const body = await request.json();
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
      amount: Number(body.amount ?? 0),
      paid: Boolean(body.paid),
      organizerStatus: body.organizerStatus,
    });
    return NextResponse.json({ registration });
  } catch {
    return NextResponse.json({ error: "Failed to sync registration." }, { status: 400 });
  }
}
