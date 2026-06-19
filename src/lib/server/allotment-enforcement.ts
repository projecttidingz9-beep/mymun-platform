import type { Prisma } from "@/generated/prisma/client";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/server/prisma";

export class AllotmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllotmentValidationError";
  }
}

export async function validateAllotmentAssignment(params: {
  eventId: string;
  registrationId: string;
  committeeName: string | null;
  portfolioName: string | null;
  portfolioId?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;

  if (!params.committeeName?.trim()) return;

  const committee = await db.committeeConfig.findFirst({
    where: {
      organizerConfig: { eventId: params.eventId },
      name: { equals: params.committeeName.trim(), mode: "insensitive" },
    },
    select: { id: true, name: true, seatCount: true },
  });

  if (!committee) {
    throw new AllotmentValidationError("Committee does not belong to this conference.");
  }

  const filled = await db.registration.count({
    where: {
      eventId: params.eventId,
      status: RegistrationStatus.ALLOTTED,
      committeeName: committee.name,
      deletedAt: null,
      NOT: { id: params.registrationId },
    },
  });
  if (filled >= committee.seatCount) {
    throw new AllotmentValidationError("Committee is full.");
  }

  if (!params.portfolioName?.trim() && !params.portfolioId) return;

  let portfolioId = params.portfolioId ?? undefined;
  if (!portfolioId && params.portfolioName) {
    const portfolio = await db.portfolio.findFirst({
      where: {
        committeeId: committee.id,
        name: { equals: params.portfolioName.trim(), mode: "insensitive" },
      },
      select: { id: true, name: true, seatCount: true },
    });
    if (!portfolio) {
      throw new AllotmentValidationError("Portfolio does not belong to this committee.");
    }
    portfolioId = portfolio.id;
  }

  if (portfolioId) {
    const portfolio = await db.portfolio.findUnique({
      where: { id: portfolioId },
      select: { id: true, name: true, seatCount: true, committeeId: true },
    });
    if (!portfolio || portfolio.committeeId !== committee.id) {
      throw new AllotmentValidationError("Invalid portfolio assignment.");
    }

    const taken = await db.registration.count({
      where: {
        eventId: params.eventId,
        status: RegistrationStatus.ALLOTTED,
        portfolioId: portfolio.id,
        deletedAt: null,
        NOT: { id: params.registrationId },
      },
    });
    if (taken >= portfolio.seatCount) {
      throw new AllotmentValidationError("Portfolio is already full.");
    }

    return { committeeId: committee.id, portfolioId: portfolio.id, portfolioName: portfolio.name };
  }

  return { committeeId: committee.id, portfolioId: null as string | null, portfolioName: null as string | null };
}
