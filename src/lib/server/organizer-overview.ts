import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import { OrganizerOverviewAnalytics } from "@/lib/types";

function toDateKey(value: Date | null | undefined) {
  if (!value) return "Unknown";
  return new Date(value).toISOString().slice(0, 10);
}

export async function getOrganizerOverviewAnalytics(eventId: string): Promise<OrganizerOverviewAnalytics> {
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    select: {
      amount: true,
      paid: true,
      status: true,
      createdAt: true,
    },
  });

  const totalRegistrations = registrations.length;
  const acceptedDelegates = registrations.filter((entry) => entry.status === RegistrationStatus.ALLOTTED).length;
  const pendingApplications = registrations.filter((entry) => entry.status === RegistrationStatus.PENDING).length;
  const waitlistedApplications = registrations.filter(
    (entry) => entry.status === RegistrationStatus.WAITLISTED
  ).length;
  const rejectedApplications = registrations.filter((entry) => entry.status === RegistrationStatus.REJECTED).length;

  const paid = registrations.filter((entry) => entry.paid);
  const revenueCollected = paid.reduce((sum, entry) => sum + entry.amount, 0);
  const paymentCompletionRate =
    totalRegistrations === 0 ? 0 : Math.round((paid.length / totalRegistrations) * 100);

  const trendMap = new Map<string, number>();
  for (const registration of registrations) {
    const key = toDateKey(registration.createdAt);
    trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
  }

  return {
    totalRegistrations,
    acceptedDelegates,
    pendingApplications,
    waitlistedApplications,
    rejectedApplications,
    paymentCompletionRate,
    revenueCollected,
    committeeFill: [],
    registrationsByCountry: [],
    registrationsByCity: [],
    applicationsTrend: Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
  };
}
