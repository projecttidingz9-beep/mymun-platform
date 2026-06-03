import { PaymentIntentStatus, RegistrationStatus, UserRole } from "@/generated/prisma/enums";
import { moneyNumber } from "./decimal-money";
import { prisma } from "./prisma";

type SyncRegistrationPayload = {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  eventStartDateIso: string;
  eventEndDateIso: string;
  userEmail: string;
  userName: string;
  categoryName: string;
  committeeName?: string;
  portfolioName?: string | null;
  amount: number;
  paid: boolean;
  organizerStatus?: "Pending" | "Allotted" | "Waitlisted" | "Rejected";
};

const mapStatus = (status?: SyncRegistrationPayload["organizerStatus"]): RegistrationStatus => {
  if (status === "Allotted") return RegistrationStatus.ALLOTTED;
  if (status === "Waitlisted") return RegistrationStatus.WAITLISTED;
  if (status === "Rejected") return RegistrationStatus.REJECTED;
  return RegistrationStatus.PENDING;
};

function reconcilePaymentFields(
  payload: SyncRegistrationPayload,
  existing: {
    amount: unknown;
    paid: boolean;
    paymentIntent: { amount: unknown; status: PaymentIntentStatus } | null;
  } | null
): { amount: number; paid: boolean } {
  if (!existing) {
    return { amount: Math.max(0, payload.amount), paid: payload.paid };
  }

  if (existing.paymentIntent) {
    const pi = existing.paymentIntent;
    const amount = moneyNumber(pi.amount);
    if (pi.status === PaymentIntentStatus.REFUNDED) {
      return { amount, paid: false };
    }
    if (pi.status === PaymentIntentStatus.CONFIRMED) {
      return { amount, paid: true };
    }
    return { amount, paid: Boolean(payload.paid) };
  }

  const amount = moneyNumber(existing.amount);
  if (existing.paid && !payload.paid) {
    throw new Error("Use the refund API to reverse a confirmed payment.");
  }
  return { amount, paid: existing.paid ? true : Boolean(payload.paid) };
}

export async function upsertRegistrationFromClient(payload: SyncRegistrationPayload) {
  const existingEvent = await prisma.event.findUnique({
    where: { id: payload.eventId },
    select: { id: true },
  });
  if (!existingEvent) {
    throw new Error("Event not found for registration sync.");
  }

  const existingRegistration = await prisma.registration.findUnique({
    where: { id: payload.registrationId },
    select: {
      amount: true,
      paid: true,
      paymentIntent: { select: { amount: true, status: true } },
    },
  });

  const { amount, paid } = reconcilePaymentFields(payload, existingRegistration);

  const user = await prisma.user.upsert({
    where: { email: payload.userEmail },
    update: { name: payload.userName },
    create: {
      email: payload.userEmail,
      name: payload.userName,
      role: UserRole.DELEGATE,
    },
  });

  const event = await prisma.event.update({
    where: { id: payload.eventId },
    data: {
      title: payload.eventTitle,
      startDate: new Date(payload.eventStartDateIso),
      endDate: new Date(payload.eventEndDateIso),
    },
  });

  const updateData = {
    userId: user.id,
    eventId: event.id,
    categoryName: payload.categoryName,
    committeeName: payload.committeeName,
    portfolioName:
      payload.portfolioName !== undefined ? payload.portfolioName : undefined,
    amount,
    paid,
    status: mapStatus(payload.organizerStatus),
    allottedAt: payload.organizerStatus === "Allotted" ? new Date() : null,
  };

  const existingActive = await prisma.registration.findFirst({
    where: { userId: user.id, eventId: event.id, deletedAt: null },
    select: { id: true },
  });

  if (existingActive && existingActive.id !== payload.registrationId) {
    return prisma.registration.update({
      where: { id: existingActive.id },
      data: updateData,
      include: { user: true, event: true },
    });
  }

  return prisma.registration
    .upsert({
      where: { id: payload.registrationId },
      update: updateData,
      create: {
        id: payload.registrationId,
        ...updateData,
      },
      include: {
        user: true,
        event: true,
        paymentIntent: true,
      },
    })
    .then(async (registration) => {
      if (paid) {
        await prisma.paymentIntent.updateMany({
          where: {
            registrationId: registration.id,
            status: { in: [PaymentIntentStatus.PENDING] },
          },
          data: { status: PaymentIntentStatus.CONFIRMED, confirmedAt: new Date() },
        });
      }
      return registration;
    });
}
