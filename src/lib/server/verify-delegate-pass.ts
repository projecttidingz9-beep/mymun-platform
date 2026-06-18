import type { DelegatePass, Registration, User, Event, Checkin } from "@/generated/prisma/client";
import { PassStatus } from "@/generated/prisma/enums";
import { hashToken, verifyPassToken } from "@/lib/server/pass-token";
import {
  requireEventOrganizerAccess,
  requireOrganizer,
  type RequestActor,
} from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export type PassWithRelations = DelegatePass & {
  registration: Registration & {
    user: User;
    event: Event;
  };
  checkins: Checkin[];
};

export type LoadPassResult =
  | { ok: true; pass: PassWithRelations; tokenHash: string }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 409; error: string };

export async function loadPassFromQrToken(qrToken: string): Promise<LoadPassResult> {
  if (!qrToken.trim()) {
    return { ok: false, status: 400, error: "QR token is required." };
  }

  let payload: { passId: string; registrationId: string; eventId: string; nonce?: string };
  try {
    payload = await verifyPassToken(qrToken);
  } catch {
    return { ok: false, status: 400, error: "Invalid delegate pass." };
  }

  if (!payload.nonce) {
    return { ok: false, status: 400, error: "Invalid delegate pass." };
  }

  const tokenHash = hashToken(qrToken);
  const pass = await prisma.delegatePass.findFirst({
    where: {
      id: payload.passId,
      deletedAt: null,
    },
    include: {
      registration: {
        include: { user: true, event: true },
      },
      checkins: true,
    },
  });

  if (
    !pass ||
    pass.qrTokenHash !== tokenHash ||
    pass.qrNonce !== payload.nonce
  ) {
    return { ok: false, status: 400, error: "Invalid delegate pass." };
  }

  if (isPassAlreadyUsed(pass)) {
    return { ok: false, status: 409, error: PASS_ALREADY_USED_ERROR };
  }

  if (pass.status !== PassStatus.ISSUED) {
    return { ok: false, status: 400, error: "Invalid delegate pass." };
  }

  if (pass.releaseAt > new Date()) {
    return { ok: false, status: 409, error: "Pass not released yet." };
  }

  return { ok: true, pass, tokenHash };
}

export function isPassAlreadyUsed(pass: PassWithRelations): boolean {
  return pass.checkins.length > 0 || pass.registration.checkedIn;
}

export async function assertOrganizerCanAccessPass(
  actor: RequestActor | null,
  eventId: string
): Promise<{ ok: true } | { ok: false; status: 403; error: string }> {
  if (!requireOrganizer(actor)) {
    return { ok: false, status: 403, error: "Organizer role required." };
  }
  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return { ok: false, status: 403, error: "You do not have access to this conference." };
  }
  return { ok: true };
}

export const PASS_ALREADY_USED_ERROR = "Pass already used for check-in.";

export function alreadyUsedResponse() {
  return {
    valid: false as const,
    alreadyUsed: true as const,
    error: PASS_ALREADY_USED_ERROR,
  };
}
