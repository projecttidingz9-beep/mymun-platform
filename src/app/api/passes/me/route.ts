import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { PassStatus, RegistrationStatus } from "@/generated/prisma/enums";
import { getRequestActor } from "@/lib/server/auth";
import { passTokenExpiresAt, signPassToken } from "@/lib/server/pass-token";
import { prisma } from "@/lib/server/prisma";
import {
  loadOrganizerBlobsByEventIds,
  resolveRegistrationApplicationType,
} from "@/lib/server/resolve-registration-application-type";
import { registrationDocumentsAcknowledged } from "@/lib/server/registration-documents-acknowledged";

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
          where: { deletedAt: null },
          include: {
            event: { select: { id: true, title: true, endDate: true } },
            pass: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ passes: [] });
    }

    const activeRegistrations = user.registrations.filter(
      (registration) =>
        registration.pass &&
        registration.pass.status === PassStatus.ISSUED &&
        !registration.pass.deletedAt &&
        !registration.checkedIn
    );

    const blobByEventId = await loadOrganizerBlobsByEventIds(
      activeRegistrations.map((r) => r.eventId)
    );

    const now = new Date();
    const passes = await Promise.all(
      activeRegistrations.map(async (registration) => {
        const pass = registration.pass!;
        const token = await signPassToken(
          {
            passId: pass.id,
            registrationId: registration.id,
            eventId: registration.eventId,
            nonce: pass.qrNonce,
          },
          passTokenExpiresAt(registration.event.endDate)
        );
        const applicationType = await resolveRegistrationApplicationType(
          registration.eventId,
          registration.categoryName,
          blobByEventId.get(registration.eventId)
        );
        const isAllotted = registration.status === RegistrationStatus.ALLOTTED;
        const { acknowledged: docsAcknowledged, pendingCount: pendingDocumentCount } =
          await registrationDocumentsAcknowledged({
            registrationId: registration.id,
            committeeName: isAllotted ? registration.committeeName : null,
            eventId: registration.eventId,
          });
        const timeReleased = pass.releaseAt <= now;
        const isReleased = timeReleased && docsAcknowledged;
        const qrImageDataUrl = isReleased ? await QRCode.toDataURL(token) : undefined;
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
          documentsAcknowledged: docsAcknowledged,
          pendingDocumentCount,
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
