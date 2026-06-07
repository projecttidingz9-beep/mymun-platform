import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "").trim();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: actor.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const registration = await prisma.registration.findFirst({
    where: {
      id: registrationId,
      userId: user.id,
      deletedAt: null,
    },
    select: { id: true, paid: true },
  });

  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (registration.paid) {
    return NextResponse.json(
      { error: "Paid registrations cannot be withdrawn. Contact the organizer for refunds." },
      { status: 400 }
    );
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
