import { RegistrationStatus } from "@/generated/prisma/enums";
import { hashToken, signPassToken } from "@/lib/server/pass-token";
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

  if (registration.pass && registration.pass.status === "ISSUED") {
    return {
      issued: false,
      alreadyIssued: true,
      passId: registration.pass.id,
      releaseAt: registration.pass.releaseAt.toISOString(),
    };
  }

  const releaseAt = options.immediateRelease
    ? new Date()
    : options.releaseAt ?? resolveReleaseAt(registration.event.startDate);

  const created = await prisma.delegatePass.create({
    data: {
      registrationId: registration.id,
      eventId: registration.eventId,
      releaseAt,
      qrTokenHash: "pending",
    },
  });

  const token = await signPassToken({
    passId: created.id,
    registrationId: registration.id,
    eventId: registration.eventId,
  });
  const tokenHash = hashToken(token);

  await prisma.delegatePass.update({
    where: { id: created.id },
    data: { qrTokenHash: tokenHash },
  });

  const shouldNotify = options.notify !== false;
  if (shouldNotify) {
    await prisma.notification.create({
      data: {
        userId: registration.userId,
        eventId: registration.eventId,
        registrationId: registration.id,
        title: "Digital pass issued",
        message: `Your digital delegate pass for ${registration.event.title} is now available.`,
        type: "PASS_RELEASED",
      },
    });
  }

  return {
    issued: true,
    alreadyIssued: false,
    passId: created.id,
    releaseAt: releaseAt.toISOString(),
    qrToken: token,
  };
}
