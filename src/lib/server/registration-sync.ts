import { RegistrationStatus, UserRole } from "@/generated/prisma/enums";
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

export async function upsertRegistrationFromClient(payload: SyncRegistrationPayload) {
  const existingEvent = await prisma.event.findUnique({
    where: { id: payload.eventId },
    select: { id: true },
  });
  if (!existingEvent) {
    throw new Error("Event not found for registration sync.");
  }

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
    amount: payload.amount,
    paid: payload.paid,
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

  return prisma.registration.upsert({
    where: { id: payload.registrationId },
    update: updateData,
    create: {
      id: payload.registrationId,
      ...updateData,
    },
    include: {
      user: true,
      event: true,
    },
  });
}
