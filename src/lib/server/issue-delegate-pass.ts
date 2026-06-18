import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { PassStatus, RegistrationStatus } from "@/generated/prisma/enums";
import {
  hashToken,
  passTokenExpiresAt,
  signPassToken,
} from "@/lib/server/pass-token";
import { logger } from "@/lib/server/logger";
import { prisma } from "@/lib/server/prisma";

export function resolveReleaseAt(startDate: Date, requestedReleaseAt?: string) {
  if (requestedReleaseAt) return new Date(requestedReleaseAt);
  const release = new Date(startDate);
  release.setDate(release.getDate() - 3);
  return release;
}

export type IssueDelegatePassOptions = {
  immediateRelease?: boolean;
  releaseAt?: Date;
  notify?: boolean;
};

export type IssueDelegatePassResult = {
  issued: boolean;
  alreadyIssued: boolean;
  passId?: string;
  releaseAt?: string;
  qrToken?: string;
  skipReason?: string;
};

async function bindPassQrToken(params: {
  passId: string;
  registrationId: string;
  eventId: string;
  eventEndDate: Date;
  qrNonce: string;
}) {
  const qrNonce = params.qrNonce;
  const token = await signPassToken(
    {
      passId: params.passId,
      registrationId: params.registrationId,
      eventId: params.eventId,
      nonce: qrNonce,
    },
    passTokenExpiresAt(params.eventEndDate)
  );
  const qrTokenHash = hashToken(token);
  await prisma.delegatePass.update({
    where: { id: params.passId },
    data: { qrNonce, qrTokenHash },
  });
  return token;
}

export async function issueDelegatePassForRegistration(
  registrationId: string,
  options: IssueDelegatePassOptions = {}
): Promise<IssueDelegatePassResult> {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true, pass: true },
  });

  if (!registration) {
    return { issued: false, alreadyIssued: false, skipReason: "registration_not_found" };
  }

  if (!registration.paid) {
    return { issued: false, alreadyIssued: false, skipReason: "not_paid" };
  }

  if (registration.status !== RegistrationStatus.ALLOTTED) {
    return { issued: false, alreadyIssued: false, skipReason: "not_allotted" };
  }

  const existingPass = registration.pass;
  if (existingPass?.status === PassStatus.ISSUED && !existingPass.deletedAt) {
    const token = await signPassToken(
      {
        passId: existingPass.id,
        registrationId: registration.id,
        eventId: registration.eventId,
        nonce: existingPass.qrNonce,
      },
      passTokenExpiresAt(registration.event.endDate)
    );
    return {
      issued: false,
      alreadyIssued: true,
      passId: existingPass.id,
      releaseAt: existingPass.releaseAt.toISOString(),
      qrToken: token,
    };
  }

  const releaseAt = options.immediateRelease
    ? new Date()
    : options.releaseAt ?? resolveReleaseAt(registration.event.startDate);

  let passId: string;

  const qrNonce = randomUUID();

  if (existingPass) {
    const updated = await prisma.delegatePass.update({
      where: { id: existingPass.id },
      data: {
        releaseAt,
        status: PassStatus.ISSUED,
        deletedAt: null,
        issuedAt: new Date(),
        qrNonce,
        qrTokenHash: "pending",
      },
    });
    passId = updated.id;
  } else {
    try {
      const created = await prisma.delegatePass.create({
        data: {
          registrationId: registration.id,
          eventId: registration.eventId,
          releaseAt,
          qrNonce,
          qrTokenHash: "pending",
        },
      });
      passId = created.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await prisma.delegatePass.findUnique({
          where: { registrationId: registration.id },
          select: { id: true },
        });
        if (!concurrent) throw error;
        passId = concurrent.id;
      } else {
        throw error;
      }
    }
  }

  const token = await bindPassQrToken({
    passId,
    registrationId: registration.id,
    eventId: registration.eventId,
    eventEndDate: registration.event.endDate,
    qrNonce,
  });

  const shouldNotify = options.notify !== false;
  if (shouldNotify) {
    const now = new Date();
    const released = releaseAt.getTime() <= now.getTime();
    const releaseLabel = releaseAt.toLocaleDateString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    try {
      await prisma.notification.create({
        data: {
          userId: registration.userId,
          eventId: registration.eventId,
          registrationId: registration.id,
          title: "Digital pass issued",
          message: released
            ? `Your digital delegate pass for ${registration.event.title} is now available.`
            : `Your delegate pass for ${registration.event.title} will be available ${releaseLabel}.`,
          type: "PASS_RELEASED",
        },
      });
    } catch (notifyError) {
      logger.warn("pass_issue_notification_failed", {
        registrationId: registration.id,
        error: notifyError instanceof Error ? notifyError.message : String(notifyError),
      });
    }
  }

  return {
    issued: true,
    alreadyIssued: false,
    passId,
    releaseAt: releaseAt.toISOString(),
    qrToken: token,
  };
}
