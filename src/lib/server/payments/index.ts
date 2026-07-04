import type { PaymentIntentStatus, PaymentProvider } from "@/generated/prisma/enums";
import { RegistrationStatus } from "@/generated/prisma/enums";
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
  paymentIntentId: string | null;
  provider: PaymentProvider | "DEFERRED";
  paymentStatus: PaymentIntentStatus | "DEFERRED";
  paid: boolean;
  amount: number;
  currency: string;
  /** True when payment is deferred until allotment is released (ALLOT_FIRST mode). */
  deferredPayment?: boolean;
};

/**
 * Creates registration row + payment intent (FREE or Cashfree).
 * Payment does not imply allotment — status stays PENDING until organizer allots.
 *
 * When `deferPayment` is true (ALLOT_FIRST conferences with a positive fee), the registration is
 * created unpaid with no payment intent — intent is created when the organizer releases allotments.
 */
export async function createRegistrationAndPayment(params: {
  registrationId: string;
  userId: string;
  eventId: string;
  categoryName: string;
  categoryId?: string;
  committeeName?: string | null;
  portfolioName?: string | null;
  committeePreferencesJson?: string | null;
  portfolioPreferencesJson?: string | null;
  countryPreferencesJson?: string | null;
  formAnswersJson?: string | null;
  amount: number;
  currency: string;
  /** Allot-first: submit application without creating a payment intent yet. */
  deferPayment?: boolean;
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

  const registrationData = {
    id: params.registrationId,
    userId: params.userId,
    eventId: params.eventId,
    categoryName: params.categoryName,
    categoryId: params.categoryId ?? null,
    committeeName: params.committeeName ?? undefined,
    portfolioName: params.portfolioName ?? undefined,
    committeePreferencesJson: params.committeePreferencesJson ?? undefined,
    portfolioPreferencesJson: params.portfolioPreferencesJson ?? undefined,
    countryPreferencesJson: params.countryPreferencesJson ?? undefined,
    formAnswersJson: params.formAnswersJson ?? undefined,
    amount,
    status: RegistrationStatus.PENDING,
    allottedAt: null as Date | null,
  };

  if (useFreeDriver) {
    const registration = await prisma.registration.create({
      data: {
        ...registrationData,
        paid: true,
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

  // Allot-first: application is submitted unpaid; payment intent is created on allotment release.
  if (params.deferPayment) {
    const registration = await prisma.registration.create({
      data: {
        ...registrationData,
        paid: false,
      },
    });

    return {
      registrationId: registration.id,
      paymentIntentId: null,
      provider: "DEFERRED",
      paymentStatus: "DEFERRED",
      paid: false,
      amount,
      currency: params.currency,
      deferredPayment: true,
    };
  }

  const registration = await prisma.registration.create({
    data: {
      ...registrationData,
      paid: false,
    },
  });

  if (paymentsMode !== "cashfree") {
    throw new Error(`Unsupported payments mode: ${paymentsMode}. Set PAYMENTS_MODE=cashfree or free.`);
  }

  const pi = await prisma.paymentIntent.create({
    data: {
      registrationId: registration.id,
      provider: "CASHFREE",
      amount,
      currency: params.currency,
      status: "PENDING",
      notes: "Awaiting Cashfree online payment",
    },
  });

  return {
    registrationId: registration.id,
    paymentIntentId: pi.id,
    provider: "CASHFREE",
    paymentStatus: pi.status,
    paid: false,
    amount,
    currency: params.currency,
  };
}

/** Ensure a PENDING Cashfree intent exists for an unpaid registration (used on allotment release). */
export async function ensurePendingPaymentIntent(params: {
  registrationId: string;
  amount: number;
  currency: string;
}): Promise<string> {
  const existing = await prisma.paymentIntent.findUnique({
    where: { registrationId: params.registrationId },
    select: { id: true, status: true },
  });
  if (existing) return existing.id;

  const amount = Math.max(0, Math.round(params.amount * 100) / 100);
  const pi = await prisma.paymentIntent.create({
    data: {
      registrationId: params.registrationId,
      provider: "CASHFREE",
      amount,
      currency: params.currency,
      status: "PENDING",
      notes: "Payment due after allotment release (allot-first mode)",
    },
  });
  return pi.id;
}
