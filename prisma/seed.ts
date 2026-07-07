/**
 * Seed demo data for local / preview environments.
 * Run: `npx prisma db seed` or `npm run db:seed`
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config();

import { assertDestructiveSeedAllowed } from "./seed-guard";

async function main() {
  assertDestructiveSeedAllowed();

  const { prisma } = await import("../src/lib/server/prisma");
  const { hashPassword } = await import("../src/lib/server/password");
  const { issueDelegatePassForRegistration } = await import("../src/lib/server/issue-delegate-pass");
  await prisma.participationCertificate.deleteMany();
  await prisma.documentAcknowledgment.deleteMany();
  await prisma.positionPaper.deleteMany();
  await prisma.committeeDocument.deleteMany();
  await prisma.applicationAnswer.deleteMany();
  await prisma.paymentIntent.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.delegatePass.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userNotificationPreference.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.pricingPhaseConfig.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.registrationCategoryConfig.deleteMany();
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
    title: "Tidingz MUN 2026",
    city: "Bengaluru",
    country: "India",
    organizerName: "Priya Organizer",
    description: "Premier Model UN on Tidingz — seed data for full lifecycle E2E.",
    registrationDeadline: "2026-08-25",
    registrationCategories: [
      {
        id: "cat-delegate",
        name: "Delegate",
        description: "Individual delegate registration",
        applicationType: "delegate",
        isOpen: true,
        basePrice: 2199,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases: [],
      },
      {
        id: "cat-chair",
        name: "Chair",
        description: "Committee chair application",
        applicationType: "chair",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: false,
        formFields: [],
        pricingPhases: [],
      },
    ],
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
      title: "Tidingz MUN 2026",
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

  const organizerConfig = await prisma.organizerConferenceConfig.findFirst({
    where: { eventId },
    select: { id: true },
  });
  if (!organizerConfig) throw new Error("Missing organizer config after seed.");

  await prisma.registrationCategoryConfig.createMany({
    data: [
      {
        categoryKey: "cat-delegate",
        organizerConfigId: organizerConfig.id,
        name: "Delegate",
        applicationType: "delegate",
        description: "Individual delegate",
        isOpen: true,
        basePrice: 2199,
        requiresCommitteeSelection: true,
        registrationDeadline: new Date("2026-08-25T23:59:59.000Z"),
      },
      {
        categoryKey: "cat-chair",
        organizerConfigId: organizerConfig.id,
        name: "Chair",
        applicationType: "chair",
        description: "Committee chair",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: false,
      },
    ],
  });

  const unscCountries = [
    "United States of America",
    "United Kingdom",
    "France",
    "China",
    "Russian Federation",
  ];
  const portfolioRows = await Promise.all(
    unscCountries.map((name) =>
      prisma.portfolio.create({
        data: { committeeId: unsc.id, name, seatCount: 1 },
      })
    )
  );
  const usaPortfolio = portfolioRows[0]!;

  const aippm = await prisma.committeeConfig.create({
    data: {
      organizerConfigId: organizerConfig.id,
      name: "AIPPM",
      agenda: "National policy coordination on climate and federalism.",
      seatCount: 10,
      committeeFormat: "AIPPM",
      type: "AIPPM",
      metadataJson: JSON.stringify({ crisisEnabled: false }),
      visibility: "PUBLIC",
    },
  });
  const aippmParties = ["Bharatiya Janata Party", "Indian National Congress", "Aam Aadmi Party"];
  await Promise.all(
    aippmParties.map((name) =>
      prisma.portfolio.create({ data: { committeeId: aippm.id, name, seatCount: 1 } })
    )
  );

  const pressCorps = await prisma.committeeConfig.create({
    data: {
      organizerConfigId: organizerConfig.id,
      name: "International Press Corps",
      agenda: "Cover committee proceedings across the conference.",
      seatCount: 6,
      committeeFormat: "PRESS_CORPS",
      type: "International Press",
      metadataJson: JSON.stringify({ pressBeatRequired: true }),
      visibility: "PUBLIC",
    },
  });
  await Promise.all(
    ["UN Security Council", "UNHRC", "General Assembly"].map((name) =>
      prisma.portfolio.create({ data: { committeeId: pressCorps.id, name, seatCount: 2 } })
    )
  );

  await prisma.committeeDocument.createMany({
    data: [
      {
        committeeId: unsc.id,
        title: "UNSC Background Guide",
        category: "background-guide",
        fileUrl: "https://example.com/unsc-background-guide.pdf",
      },
      {
        committeeId: aippm.id,
        title: "AIPPM Background Guide",
        category: "background-guide",
        fileUrl: "https://example.com/aippm-background-guide.pdf",
      },
    ],
  });

  await prisma.registrationCategoryConfig.create({
    data: {
      categoryKey: "cat-delegation",
      organizerConfigId: organizerConfig.id,
      name: "Delegation Head",
      applicationType: "delegation",
      description: "School delegation registration",
      isOpen: true,
      basePrice: 4999,
      requiresCommitteeSelection: false,
      maxDelegatesPerDelegation: 12,
    },
  });

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
      categoryId: "cat-delegate",
      categoryName: "Delegate",
      committeeName: unsc.name,
      portfolioId: usaPortfolio.id,
      portfolioName: usaPortfolio.name,
      amount: 2199,
      paid: true,
      status: "ALLOTTED",
      allottedAt: new Date(),
      committeePreferencesJson: JSON.stringify([unsc.name, unhcr.name]),
      countryPreferencesJson: JSON.stringify(["United States of America", "France"]),
      portfolioPreferencesJson: JSON.stringify({
        [unsc.id]: [usaPortfolio.name, "France"],
      }),
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

  const passIssue = await issueDelegatePassForRegistration(reg1.id, { immediateRelease: true });
  if (!passIssue.issued && !passIssue.alreadyIssued) {
    console.warn("Seed pass issue:", passIssue.skipReason);
  }

  const unscBackgroundGuide = await prisma.committeeDocument.findFirst({
    where: { committeeId: unsc.id, category: "background-guide" },
    select: { id: true },
  });
  if (unscBackgroundGuide) {
    await prisma.documentAcknowledgment.create({
      data: {
        registrationId: reg1.id,
        documentId: unscBackgroundGuide.id,
      },
    });
  }

  await prisma.participationCertificate.create({
    data: {
      registrationId: reg1.id,
      eventId,
      issuedByUserId: org1.id,
    },
  });

  const delegation = await prisma.delegation.create({
    data: {
      eventId,
      inviteToken: "seed-delegation-invite-token",
      schoolName: "Delhi Public School",
      name: "Delhi Public School",
      maxMembers: 8,
      ownerUserId: delegates[2].id,
      status: "OPEN",
    },
  });

  await prisma.registration.update({
    where: { id: reg1.id },
    data: { delegationId: delegation.id, isDelegationHead: false },
  });

  await prisma.positionPaper.create({
    data: {
      registrationId: reg1.id,
      eventId,
      committeeId: unsc.id,
      textContent: "Seed position paper on Middle East crisis response.",
      status: "PENDING",
    },
  });

  await prisma.conferenceAward.create({
    data: {
      eventId,
      category: "Best Delegate",
      presetKey: "best_delegate",
      prizeTitle: "Best Delegate",
      recipientRegistrationId: reg1.id,
      recipientUserId: delegates[0].id,
      participantName: delegates[0].name,
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

  const envAdminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (envAdminEmail && envAdminEmail !== admin.email.toLowerCase()) {
    const existing = await prisma.user.findUnique({
      where: { email: envAdminEmail },
      select: { id: true },
    });
    if (!existing) {
      const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || "TidingzDemo1";
      const envAdminHash = await hashPassword(seedAdminPassword);
      await prisma.user.create({
        data: {
          email: envAdminEmail,
          name: envAdminEmail.split("@")[0] || "Admin",
          role: "ADMIN",
          passwordHash: envAdminHash,
          emailVerified: true,
        },
      });
      console.log(`Also created super-admin from ADMIN_EMAIL: ${envAdminEmail}`);
      console.log(`  Password: ${seedAdminPassword} (set SEED_ADMIN_PASSWORD to override)`);
    } else {
      console.log(`ADMIN_EMAIL user already exists (not modified): ${envAdminEmail}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
