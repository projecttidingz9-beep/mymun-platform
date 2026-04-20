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
  portfolioName?: string;
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
  const user = await prisma.user.upsert({
    where: { email: payload.userEmail },
    update: { name: payload.userName },
    create: {
      email: payload.userEmail,
      name: payload.userName,
      role: UserRole.DELEGATE,
    },
  });

  const event = await prisma.event.upsert({
    where: { id: payload.eventId },
    update: {
      title: payload.eventTitle,
      startDate: new Date(payload.eventStartDateIso),
      endDate: new Date(payload.eventEndDateIso),
    },
    create: {
      id: payload.eventId,
      title: payload.eventTitle,
      startDate: new Date(payload.eventStartDateIso),
      endDate: new Date(payload.eventEndDateIso),
    },
  });

  return await prisma.registration.upsert({
    where: { id: payload.registrationId },
    update: {
      userId: user.id,
      eventId: event.id,
      categoryName: payload.categoryName,
      committeeName: payload.committeeName,
      portfolioName: payload.portfolioName,
      amount: payload.amount,
      paid: payload.paid,
      status: mapStatus(payload.organizerStatus),
      allottedAt: payload.organizerStatus === "Allotted" ? new Date() : null,
    },
    create: {
      id: payload.registrationId,
      userId: user.id,
      eventId: event.id,
      categoryName: payload.categoryName,
      committeeName: payload.committeeName,
      portfolioName: payload.portfolioName,
      amount: payload.amount,
      paid: payload.paid,
      status: mapStatus(payload.organizerStatus),
      allottedAt: payload.organizerStatus === "Allotted" ? new Date() : null,
    },
    include: {
      user: true,
      event: true,
    },
  });
}
