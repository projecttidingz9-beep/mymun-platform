import type { PaymentIntentStatus, PaymentProvider } from "@/generated/prisma/enums";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma, runPrismaTransaction } from "@/lib/server/prisma";
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

const ALLOT_FIRST_PI_NOTES = "Payment due after allotment release (allot-first mode)";

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
  delegationId?: string | null;
  isDelegationHead?: boolean;
  amount: number;
  currency: string;
  /** Allot-first: submit application without creating a payment intent yet. */
  deferPayment?: boolean;
}): Promise<RegistrationCheckoutResult> {
  const { paymentsMode } = getAppConfig();
  if (paymentsMode !== "free" && paymentsMode !== "cashfree") {
    throw new Error(
      `Unsupported payments mode: ${paymentsMode}. Set PAYMENTS_MODE=cashfree or free.`
    );
  }

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
    delegationId: params.delegationId ?? undefined,
    isDelegationHead: params.isDelegationHead ?? false,
    amount,
    status: RegistrationStatus.PENDING,
    allottedAt: null as Date | null,
  };

  // Allot-first: application is submitted unpaid; payment intent is created on allotment release.
  if (!useFreeDriver && params.deferPayment) {
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

  return runPrismaTransaction(async (tx) => {
    if (useFreeDriver) {
      const registration = await tx.registration.create({
        data: {
          ...registrationData,
          paid: true,
        },
      });

      const pi = await tx.paymentIntent.create({
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
        provider: "FREE" as const,
        paymentStatus: "CONFIRMED" as const,
        paid: true,
        amount,
        currency: params.currency,
      };
    }

    const registration = await tx.registration.create({
      data: {
        ...registrationData,
        paid: false,
      },
    });

    const pi = await tx.paymentIntent.create({
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
      provider: "CASHFREE" as const,
      paymentStatus: pi.status,
      paid: false,
      amount,
      currency: params.currency,
    };
  });
}

/**
 * Ensure a PENDING Cashfree intent exists for an unpaid registration (used on allotment release).
 * Revives CANCELLED/REFUNDED intents so re-release after expiry or decline can charge again.
 */
export async function ensurePendingPaymentIntent(params: {
  registrationId: string;
  amount: number;
  currency: string;
}): Promise<string> {
  const amount = Math.max(0, Math.round(params.amount * 100) / 100);
  const existing = await prisma.paymentIntent.findUnique({
    where: { registrationId: params.registrationId },
    select: { id: true, status: true },
  });

  if (!existing) {
    const pi = await prisma.paymentIntent.create({
      data: {
        registrationId: params.registrationId,
        provider: "CASHFREE",
        amount,
        currency: params.currency,
        status: "PENDING",
        notes: ALLOT_FIRST_PI_NOTES,
      },
    });
    return pi.id;
  }

  if (existing.status === "PENDING") {
    await prisma.paymentIntent.update({
      where: { id: existing.id },
      data: {
        amount,
        currency: params.currency,
        notes: ALLOT_FIRST_PI_NOTES,
        // Clear stale Cashfree order so a new order is created at the updated amount.
        reference: null,
      },
    });
    return existing.id;
  }

  if (existing.status === "CONFIRMED") {
    return existing.id;
  }

  // CANCELLED or REFUNDED — revive for a new payment attempt; clear Cashfree order reference.
  await prisma.paymentIntent.update({
    where: { id: existing.id },
    data: {
      status: "PENDING",
      provider: "CASHFREE",
      amount,
      currency: params.currency,
      confirmedAt: null,
      confirmedByUserId: null,
      reference: null,
      notes: ALLOT_FIRST_PI_NOTES,
    },
  });
  return existing.id;
}
