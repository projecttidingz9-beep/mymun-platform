/**
 * Seed demo data for local / preview environments.
 * Run: `npx prisma db seed` or `npm run db:seed`
 */
import "dotenv/config";
import { prisma } from "../src/lib/server/prisma";
import { hashPassword } from "../src/lib/server/password";

async function main() {
  await prisma.applicationAnswer.deleteMany();
  await prisma.paymentIntent.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.delegatePass.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userNotificationPreference.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.pricingPhaseConfig.deleteMany();
  await prisma.applicationQuestion.deleteMany();
  await prisma.committeeConfig.deleteMany();
  await prisma.organizerConferenceConfig.deleteMany();
  await prisma.eventTeamMember.deleteMany();
  await prisma.conferenceAward.deleteMany();
  await prisma.conferenceReview.deleteMany();
  await prisma.delegationMember.deleteMany();
  await prisma.delegation.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.rateLimitBucket.deleteMany();
  await prisma.eventPartnership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword("TidingzDemo1");

  const admin = await prisma.user.create({
    data: {
      email: "admin@tidingz.demo",
      name: "Tidingz Admin",
      role: "ADMIN",
      passwordHash,
      emailVerified: true,
    },
  });

  const org1 = await prisma.user.create({
    data: {
      email: "organizer1@tidingz.demo",
      name: "Priya Organizer",
      role: "ORGANIZER",
      passwordHash,
      emailVerified: true,
    },
  });

  const org2 = await prisma.user.create({
    data: {
      email: "organizer2@tidingz.demo",
      name: "Alex Organizer",
      role: "ORGANIZER",
      passwordHash,
      emailVerified: true,
    },
  });

  const delegates = await Promise.all(
    ["delegate1", "delegate2", "delegate3", "delegate4", "delegate5"].map((slug, i) =>
      prisma.user.create({
        data: {
          email: `${slug}@tidingz.demo`,
          name: `Delegate ${i + 1}`,
          role: "DELEGATE",
          passwordHash,
          emailVerified: true,
        },
      })
    )
  );

  const eventId = "evt-seed-global-summit-2026";
  const start = new Date("2026-09-01T09:00:00.000Z");
  const end = new Date("2026-09-03T18:00:00.000Z");
  const PREVIEW_JSON_PREFIX = "__preview_json__:";
  const previewBlob = {
    title: "Global Summit MUN 2026",
    city: "Bengaluru",
    country: "India",
    organizerName: "Priya Organizer",
    description: "Premier Model UN hosted on Tidingz (seed data).",
    whatIsIncluded: ["Committee materials", "Opening & closing ceremonies", "Delegate kit"],
    conferenceSchedule: [
      {
        id: "seed-schedule-1",
        day: "Day 1",
        fromTime: "09:00",
        toTime: "10:30",
        title: "Opening Ceremony",
      },
    ],
    termsAndConditions: "Seed terms and conditions for E2E verification.",
    refundPolicy: "Full refund until 30 days before the conference.",
    commonDocuments: [
      {
        id: "seed-doc-handbook",
        title: "Delegate Handbook",
        category: "guidelines",
        sourceType: "url",
        url: "https://example.com/seed-delegate-handbook.pdf",
      },
    ],
    level: "University",
    tags: ["Global", "University"],
  };

  await prisma.event.create({
    data: {
      id: eventId,
      title: "Global Summit MUN 2026",
      startDate: start,
      endDate: end,
      slug: "global-summit-mun-2026",
      status: "PUBLISHED",
      timezone: "Asia/Kolkata",
      currency: "INR",
      ownerUserId: org1.id,
      organizerConfig: {
        create: {
          description: `${PREVIEW_JSON_PREFIX}${JSON.stringify(previewBlob)}`,
          venue: "International Convention Centre, Bengaluru, India",
          paymentUpi: "tidingz.demo@paytm",
          paymentBankHint: "Tidingz Demo Bank • A/C ****4242",
          paymentNotesMarkdown: "Use UPI or bank transfer. Include your registration ID in the reference.",
          committees: {
            create: [
              {
                name: "UN Security Council",
                agenda: "Maintaining international peace — Middle East crisis simulations.",
                seatCount: 15,
                basePrice: 2499,
                visibility: "PUBLIC",
              },
              {
                name: "UNHCR",
                agenda: "Refugee protection and durable solutions.",
                seatCount: 40,
                basePrice: 1999,
                visibility: "PUBLIC",
              },
            ],
          },
          pricingPhases: {
            create: [
              {
                name: "Early Bird",
                startDate: new Date("2026-05-01T00:00:00.000Z"),
                endDate: new Date("2026-07-15T23:59:59.000Z"),
                basePrice: 1799,
              },
              {
                name: "Regular",
                startDate: new Date("2026-07-16T00:00:00.000Z"),
                endDate: new Date("2026-08-25T23:59:59.000Z"),
                basePrice: 2199,
              },
            ],
          },
        },
      },
    },
  });

  const committees = await prisma.committeeConfig.findMany({
    where: { organizerConfig: { eventId } },
  });
  const unsc = committees.find((c) => c.name.includes("Security"))!;
  const unhcr = committees.find((c) => c.name.includes("UNHCR"))!;

  await prisma.applicationQuestion.createMany({
    data: [
      {
        committeeId: unsc.id,
        label: "Prior MUN experience",
        type: "select",
        required: true,
        optionsJson: JSON.stringify(["First conference", "2–5 conferences", "5+ conferences"]),
      },
      {
        committeeId: unhcr.id,
        label: "Why UNHCR?",
        type: "textarea",
        required: true,
      },
    ],
  });

  await prisma.eventTeamMember.create({
    data: {
      eventId,
      userId: org1.id,
      role: "LEAD_ORGANIZER",
      acceptedAt: new Date(),
    },
  });

  await prisma.eventTeamMember.create({
    data: {
      eventId,
      userId: org2.id,
      role: "USG",
      acceptedAt: new Date(),
    },
  });

  const reg1 = await prisma.registration.create({
    data: {
      id: "reg-seed-001",
      userId: delegates[0].id,
      eventId,
      categoryName: "Delegate",
      committeeName: unsc.name,
      amount: 2199,
      paid: true,
      status: "ALLOTTED",
      allottedAt: new Date(),
    },
  });

  await prisma.paymentIntent.create({
    data: {
      registrationId: reg1.id,
      provider: "MANUAL",
      amount: 2199,
      currency: "INR",
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedByUserId: org1.id,
      reference: "UPI-SEED-001",
    },
  });

  await prisma.registration.create({
    data: {
      id: "reg-seed-002",
      userId: delegates[1].id,
      eventId,
      categoryName: "Delegate",
      committeeName: unhcr.name,
      amount: 1999,
      paid: false,
      status: "PENDING",
    },
  });

  await prisma.paymentIntent.create({
    data: {
      registrationId: "reg-seed-002",
      provider: "MANUAL",
      amount: 1999,
      currency: "INR",
      status: "PENDING",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: delegates[0].id,
        eventId,
        registrationId: reg1.id,
        title: "Registration confirmed",
        message: "Your committee assignment is visible on your dashboard.",
        type: "APP_STATUS",
      },
      {
        userId: delegates[1].id,
        eventId,
        title: "Payment pending",
        message: "Complete payment using the instructions on the conference page.",
        type: "ANNOUNCEMENT",
      },
    ],
  });

  await prisma.userNotificationPreference.createMany({
    data: [
      { userId: delegates[0].id, notificationType: "APP_STATUS", emailEnabled: true, inAppEnabled: true },
      { userId: delegates[0].id, notificationType: "PASS_RELEASED", emailEnabled: true, inAppEnabled: true },
    ],
    skipDuplicates: true,
  });

  await prisma.conferenceReview.create({
    data: {
      eventId,
      userId: delegates[0].id,
      rating: 5,
      comment: "Excellent committees and hospitality (seed review).",
      status: "approved",
      featured: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      eventId,
      action: "seed",
      entity: "database",
      entityId: "seed-run",
      after: { message: "Demo seed completed" },
    },
  });

  console.log("Seed OK. Demo password for all users: TidingzDemo1");
  console.log({
    admin: admin.email,
    organizers: [org1.email, org2.email],
    delegates: delegates.map((d) => d.email),
    conference: `${eventId} /global-summit-mun-2026`,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
