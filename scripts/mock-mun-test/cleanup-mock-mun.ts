import dotenv from "dotenv";
import { resolve } from "node:path";
import { revalidateTag } from "next/cache";
import { QA_EVENT_ID, QA_USER_EMAILS } from "./constants";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config();

export async function cleanupMockMun() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }

  const { prisma } = await import("../../src/lib/server/prisma");
  const { MARKETPLACE_CACHE_TAG } = await import("../../src/lib/server/marketplace-queries");

  const event = await prisma.event.findUnique({
    where: { id: QA_EVENT_ID },
    select: { id: true },
  });

  if (!event) {
    console.log("No QA event found — nothing to clean up.");
    await prisma.$disconnect();
    return { removed: false };
  }

  const registrations = await prisma.registration.findMany({
    where: { eventId: QA_EVENT_ID },
    select: { id: true },
  });
  const registrationIds = registrations.map((r) => r.id);

  const delegations = await prisma.delegation.findMany({
    where: { eventId: QA_EVENT_ID },
    select: { id: true },
  });
  const delegationIds = delegations.map((d) => d.id);

  await prisma.documentAcknowledgment.deleteMany({
    where: { registrationId: { in: registrationIds } },
  });
  await prisma.positionPaper.deleteMany({
    where: { OR: [{ eventId: QA_EVENT_ID }, { registrationId: { in: registrationIds } }] },
  });
  await prisma.paymentIntent.deleteMany({ where: { registrationId: { in: registrationIds } } });
  await prisma.checkin.deleteMany({ where: { registrationId: { in: registrationIds } } });
  await prisma.delegatePass.deleteMany({ where: { registrationId: { in: registrationIds } } });
  await prisma.notification.deleteMany({
    where: { OR: [{ eventId: QA_EVENT_ID }, { registrationId: { in: registrationIds } }] },
  });
  await prisma.registration.deleteMany({ where: { eventId: QA_EVENT_ID } });
  await prisma.delegationMember.deleteMany({ where: { delegationId: { in: delegationIds } } });
  await prisma.delegation.deleteMany({ where: { eventId: QA_EVENT_ID } });
  await prisma.conferenceAward.deleteMany({ where: { eventId: QA_EVENT_ID } });
  await prisma.conferenceReview.deleteMany({ where: { eventId: QA_EVENT_ID } });
  await prisma.auditLog.deleteMany({ where: { eventId: QA_EVENT_ID } });
  await prisma.eventPartnership.deleteMany({
    where: { OR: [{ sourceEventId: QA_EVENT_ID }, { targetEventId: QA_EVENT_ID }] },
  });
  await prisma.eventTeamMember.deleteMany({ where: { eventId: QA_EVENT_ID } });

  const organizerConfig = await prisma.organizerConferenceConfig.findUnique({
    where: { eventId: QA_EVENT_ID },
    select: { id: true },
  });

  if (organizerConfig) {
    const committees = await prisma.committeeConfig.findMany({
      where: { organizerConfigId: organizerConfig.id },
      select: { id: true },
    });
    const committeeIds = committees.map((c) => c.id);
    if (committeeIds.length > 0) {
      await prisma.committeeDocument.deleteMany({ where: { committeeId: { in: committeeIds } } });
      await prisma.applicationQuestion.deleteMany({ where: { committeeId: { in: committeeIds } } });
      await prisma.portfolio.deleteMany({ where: { committeeId: { in: committeeIds } } });
      await prisma.committeeConfig.deleteMany({ where: { id: { in: committeeIds } } });
    }
    await prisma.registrationCategoryConfig.deleteMany({
      where: { organizerConfigId: organizerConfig.id },
    });
    await prisma.pricingPhaseConfig.deleteMany({
      where: { organizerConfigId: organizerConfig.id },
    });
    await prisma.organizerConferenceConfig.delete({ where: { eventId: QA_EVENT_ID } });
  }

  await prisma.event.delete({ where: { id: QA_EVENT_ID } });

  const qaUsers = await prisma.user.findMany({
    where: { email: { in: QA_USER_EMAILS } },
    select: { id: true },
  });
  const qaUserIds = qaUsers.map((u) => u.id);

  if (qaUserIds.length > 0) {
    await prisma.userNotificationPreference.deleteMany({ where: { userId: { in: qaUserIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: qaUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: qaUserIds } } });
  }

  try {
    revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
  } catch {
    // non-blocking
  }

  const residualEvent = await prisma.event.count({ where: { id: QA_EVENT_ID } });
  const residualUsers = await prisma.user.count({ where: { email: { in: QA_USER_EMAILS } } });

  await prisma.$disconnect();

  if (residualEvent > 0 || residualUsers > 0) {
    throw new Error(
      `Cleanup incomplete: events=${residualEvent}, users=${residualUsers}`
    );
  }

  console.log("QA mock MUN cleanup complete — zero residual rows.");
  return { removed: true };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  cleanupMockMun().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
