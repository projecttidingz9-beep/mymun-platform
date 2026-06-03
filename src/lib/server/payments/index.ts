import type { PaymentIntentStatus, PaymentProvider } from "@/generated/prisma/enums";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { issueDelegatePassForRegistration } from "@/lib/server/issue-delegate-pass";
import { prisma } from "@/lib/server/prisma";
import { getAppConfig } from "@/lib/app-config";

/** One active registration per user per event (see DB partial unique index). */
export class DuplicateActiveRegistrationError extends Error {
  readonly existingRegistrationId: string;

  constructor(existingRegistrationId: string) {
    super("You already have an active registration for this conference.");
    this.name = "DuplicateActiveRegistrationError";
    this.existingRegistrationId = existingRegistrationId;
  }
}

export type RegistrationCheckoutResult = {
  registrationId: string;
  paymentIntentId: string;
  provider: PaymentProvider;
  paymentStatus: PaymentIntentStatus;
  paid: boolean;
  amount: number;
  currency: string;
};

/**
 * Creates registration row + payment intent using FREE or MANUAL drivers (no live gateway).
 */
export async function createRegistrationAndPayment(params: {
  registrationId: string;
  userId: string;
  eventId: string;
  categoryName: string;
  committeeName?: string | null;
  portfolioName?: string | null;
  amount: number;
  currency: string;
}): Promise<RegistrationCheckoutResult> {
  const { paymentsMode } = getAppConfig();
  const amount = Math.max(0, Math.round(params.amount * 100) / 100);

  const duplicate = await prisma.registration.findFirst({
    where: {
      userId: params.userId,
      eventId: params.eventId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new DuplicateActiveRegistrationError(duplicate.id);
  }

  const isFreeAmount = amount <= 0;
  const useFreeDriver = isFreeAmount || paymentsMode === "free";

  if (useFreeDriver) {
    const registration = await prisma.registration.create({
      data: {
        id: params.registrationId,
        userId: params.userId,
        eventId: params.eventId,
        categoryName: params.categoryName,
        committeeName: params.committeeName ?? undefined,
        portfolioName: params.portfolioName ?? undefined,
        amount,
        paid: true,
        status: RegistrationStatus.ALLOTTED,
        allottedAt: new Date(),
      },
    });

    const pi = await prisma.paymentIntent.create({
      data: {
        registrationId: registration.id,
        provider: "FREE",
        amount,
        currency: params.currency,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        notes: "Free registration",
      },
    });

    try {
      await issueDelegatePassForRegistration(registration.id, { immediateRelease: true });
    } catch {
      // Registration succeeded; pass issuance is best-effort.
    }

    return {
      registrationId: registration.id,
      paymentIntentId: pi.id,
      provider: "FREE",
      paymentStatus: "CONFIRMED",
      paid: true,
      amount,
      currency: params.currency,
    };
  }

  const registration = await prisma.registration.create({
    data: {
      id: params.registrationId,
      userId: params.userId,
      eventId: params.eventId,
      categoryName: params.categoryName,
      committeeName: params.committeeName ?? undefined,
      portfolioName: params.portfolioName ?? undefined,
      amount,
      paid: false,
      status: RegistrationStatus.PENDING,
    },
  });

  const pi = await prisma.paymentIntent.create({
    data: {
      registrationId: registration.id,
      provider: "MANUAL",
      amount,
      currency: params.currency,
      status: "PENDING",
      notes: "Awaiting organizer confirmation of offline payment",
    },
  });

  return {
    registrationId: registration.id,
    paymentIntentId: pi.id,
    provider: "MANUAL",
    paymentStatus: pi.status,
    paid: false,
    amount,
    currency: params.currency,
  };
}
