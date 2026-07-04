import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma, runPrismaTransaction } from "@/lib/server/prisma";

/**
 * Cancels released allotments that were not paid by paymentDeadlineAt (allot-first mode).
 * Safe to call frequently (idempotent).
 */
export async function expireOverdueAllotmentPayments(options?: {
  userId?: string;
  eventId?: string;
}): Promise<number> {
  const now = new Date();
  const overdue = await prisma.registration.findMany({
    where: {
      deletedAt: null,
      paid: false,
      status: RegistrationStatus.ALLOTTED,
      released: true,
      paymentDeadlineAt: { lt: now },
      allotmentDeclinedAt: null,
      ...(options?.userId ? { userId: options.userId } : {}),
      ...(options?.eventId ? { eventId: options.eventId } : {}),
    },
    select: { id: true, userId: true, eventId: true, event: { select: { title: true } } },
  });

  if (overdue.length === 0) return 0;

  const ids = overdue.map((r) => r.id);

  await runPrismaTransaction(async (tx) => {
    await tx.registration.updateMany({
      where: { id: { in: ids } },
      data: {
        status: RegistrationStatus.PENDING,
        committeeName: null,
        portfolioName: null,
        portfolioId: null,
        allottedAt: null,
        released: false,
        releasedAt: null,
        paymentDeadlineAt: null,
      },
    });

    await tx.paymentIntent.updateMany({
      where: {
        registrationId: { in: ids },
        status: "PENDING",
      },
      data: { status: "CANCELLED" },
    });

    await tx.notification.createMany({
      data: overdue.map((reg) => ({
        userId: reg.userId,
        eventId: reg.eventId,
        registrationId: reg.id,
        title: "Allotment cancelled",
        message: `Your allotment for ${reg.event.title} was cancelled because payment was not completed by the deadline.`,
        type: "APP_STATUS",
        read: false,
      })),
    });
  });

  return overdue.length;
}
