import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor } from "@/lib/server/auth";
import { signPassToken } from "@/lib/server/pass-token";
import { prisma } from "@/lib/server/prisma";
import { resolveRegistrationApplicationType } from "@/lib/server/resolve-registration-application-type";

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized actor." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: actor.email },
      include: {
        registrations: {
          include: {
            event: true,
            pass: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ passes: [] });
    }

    const now = new Date();
    const passes = await Promise.all(
      user.registrations
        .filter((registration) => registration.pass)
        .map(async (registration) => {
          const pass = registration.pass!;
          const token = await signPassToken({
            passId: pass.id,
            registrationId: registration.id,
            eventId: registration.eventId,
          });
          const isReleased = pass.releaseAt <= now;
          const qrImageDataUrl = isReleased ? await QRCode.toDataURL(token) : undefined;
          const applicationType = await resolveRegistrationApplicationType(
            registration.eventId,
            registration.categoryName
          );
          const isAllotted = registration.status === RegistrationStatus.ALLOTTED;
          return {
            id: pass.id,
            registrationId: registration.id,
            eventId: registration.eventId,
            eventName: registration.event.title,
            delegateName: user.name,
            applicationType,
            categoryName: registration.categoryName,
            committeeName: isAllotted ? registration.committeeName : null,
            portfolioName: isAllotted ? registration.portfolioName : null,
            status: registration.status,
            checkedIn: registration.checkedIn,
            checkedInAt: registration.checkedInAt?.toISOString() ?? null,
            releaseAt: pass.releaseAt.toISOString(),
            released: isReleased,
            issuedAt: pass.issuedAt.toISOString(),
            qrToken: isReleased ? token : null,
            qrImageDataUrl,
          };
        })
    );

    return NextResponse.json({ passes });
  } catch {
    return NextResponse.json({ error: "Failed to fetch event passes." }, { status: 500 });
  }
}
