import { NextRequest, NextResponse } from "next/server";
import { getRequestActor } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ registrationId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = await context.params;
  const registrationId = String(params.registrationId || "");
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
    where: { id: registrationId, userId: user.id, deletedAt: null },
    include: {
      participationCertificate: true,
      event: { select: { title: true } },
      user: { select: { name: true } },
    },
  });

  if (!registration?.participationCertificate) {
    return NextResponse.json({ error: "Certificate not issued yet." }, { status: 404 });
  }

  const cert = registration.participationCertificate;
  return NextResponse.json({
    certificateId: cert.id,
    issuedAt: cert.issuedAt.toISOString(),
    delegateName: registration.user.name,
    eventName: registration.event.title,
    committeeName: registration.committeeName,
    portfolioName: registration.portfolioName,
    categoryName: registration.categoryName,
  });
}
