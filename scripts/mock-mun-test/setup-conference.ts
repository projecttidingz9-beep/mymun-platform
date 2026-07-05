import dotenv from "dotenv";
import { resolve } from "node:path";
import { revalidateTag } from "next/cache";
import {
  QA_CATEGORY,
  QA_COMMITTEE,
  QA_EVENT_ID,
  QA_EVENT_SLUG,
  QA_EVENT_TITLE,
  QA_PASSWORD,
  QA_PERSONAS,
  QA_PORTFOLIO,
} from "./constants";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config();

const PREVIEW_JSON_PREFIX = "__preview_json__:";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type SetupResult = {
  eventId: string;
  slug: string;
  committeeIds: typeof QA_COMMITTEE;
  categoryIds: typeof QA_CATEGORY;
  portfolioIds: typeof QA_PORTFOLIO;
  organizerUserId: string;
};

export async function setupMockMunConference(): Promise<SetupResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }

  const { prisma } = await import("../../src/lib/server/prisma");
  const { hashPassword } = await import("../../src/lib/server/password");
  const { mergeOrganizerStoredBlob } = await import("../../src/lib/server/organizer-config-store");
  const { MARKETPLACE_CACHE_TAG } = await import("../../src/lib/server/marketplace-queries");

  const now = new Date();
  const startDate = addMonths(now, 4);
  startDate.setUTCHours(9, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getDate() + 3);
  endDate.setUTCHours(18, 0, 0, 0);
  const registrationDeadline = addMonths(now, 3);
  const pastDeadline = new Date(now);
  pastDeadline.setUTCDate(pastDeadline.getUTCDate() - 7);

  const phaseStart = new Date(now);
  phaseStart.setUTCDate(phaseStart.getUTCDate() - 14);
  const phaseEnd = new Date(registrationDeadline);

  const passwordHash = await hashPassword(QA_PASSWORD);

  // Upsert all QA users
  const userIds: Record<string, string> = {};
  for (const [key, persona] of Object.entries(QA_PERSONAS)) {
    const user = await prisma.user.upsert({
      where: { email: persona.email },
      create: {
        email: persona.email,
        name: persona.name,
        role: persona.role,
        passwordHash,
        emailVerified: true,
      },
      update: {
        name: persona.name,
        role: persona.role,
        passwordHash,
        emailVerified: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    userIds[key] = user.id;
  }

  const organizerUserId = userIds.organizer!;

  const previewBlob = {
    eventId: QA_EVENT_ID,
    ownerUserId: organizerUserId,
    ownerEmail: QA_PERSONAS.organizer.email,
    title: QA_EVENT_TITLE,
    city: "Bengaluru",
    country: "India",
    organizerName: QA_PERSONAS.organizer.name,
    contactDetail: `${QA_PERSONAS.organizer.email} · +919876543210`,
    description:
      "Automated QA mock conference for end-to-end MUN lifecycle testing. DO NOT REGISTER — this is internal QA data.",
    registrationDeadline: isoDateOnly(registrationDeadline),
    level: "University",
    tags: ["QA", "Internal Test"],
    capacity: 120,
    startDate: isoDateOnly(startDate),
    endDate: isoDateOnly(endDate),
    venue: "QA Convention Centre, Bengaluru, India",
    whatIsIncluded: ["Delegate kit", "Opening ceremony", "Socials"],
    conferenceSchedule: [
      {
        id: "qa-schedule-1",
        day: "Day 1",
        fromTime: "09:00",
        toTime: "10:30",
        title: "Opening Ceremony",
      },
      {
        id: "qa-schedule-2",
        day: "Day 2",
        fromTime: "14:00",
        toTime: "17:00",
        title: "Committee Sessions",
      },
    ],
    termsAndConditions: "QA test terms — not a real conference.",
    refundPolicy: "N/A — QA test event.",
    codeOfConduct: "Be respectful during QA testing.",
    faqNotes: "This is an internal QA conference.",
    commonDocuments: [
      {
        id: "qa-doc-handbook",
        title: "QA Delegate Handbook",
        category: "guidelines",
        sourceType: "url",
        url: "https://example.com/qa-handbook.pdf",
      },
    ],
    registrationCategories: [
      {
        id: QA_CATEGORY.DELEGATE,
        name: "Delegate Registration",
        description: "Individual delegate — free for QA.",
        applicationType: "delegate",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases: [
          {
            id: "qa-phase-active",
            name: "QA Active Phase",
            startDate: isoDateOnly(phaseStart),
            endDate: isoDateOnly(phaseEnd),
            basePrice: 0,
          },
        ],
      },
      {
        id: QA_CATEGORY.CHAIR,
        name: "Chair Registration",
        description: "Executive board applications.",
        applicationType: "chair",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: false,
        formFields: [],
        pricingPhases: [],
      },
      {
        id: QA_CATEGORY.PRESS,
        name: "Press Registration",
        description: "International Press Corps.",
        applicationType: "press",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases: [],
      },
      {
        id: QA_CATEGORY.DELEGATION,
        name: "Delegation Registration",
        description: "School delegation head.",
        applicationType: "delegation",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: false,
        maxDelegatesPerDelegation: 8,
        formFields: [],
        pricingPhases: [],
      },
      {
        id: QA_CATEGORY.CLOSED,
        name: "Closed Category (QA)",
        description: "Deadline passed — for negative testing.",
        applicationType: "delegate",
        isOpen: true,
        basePrice: 0,
        requiresCommitteeSelection: false,
        deadlineOverride: isoDateOnly(pastDeadline),
        formFields: [],
        pricingPhases: [],
      },
    ],
    committees: [
      {
        id: QA_COMMITTEE.UNSC,
        name: "UN Security Council",
        agenda: "Maintaining international peace in the Middle East.",
        seatCount: 5,
        basePrice: 0,
        isPublic: true,
        portfolios: [
          { id: QA_PORTFOLIO.USA, name: "United States of America", seatCount: 1 },
          { id: QA_PORTFOLIO.UK, name: "United Kingdom", seatCount: 1 },
          { id: QA_PORTFOLIO.FRANCE, name: "France", seatCount: 1 },
        ],
        documents: [
          {
            id: "qa-unsc-bg",
            title: "UNSC Background Guide",
            category: "background-guide",
            url: "https://example.com/qa-unsc-bg.pdf",
          },
        ],
      },
      {
        id: QA_COMMITTEE.UNHRC,
        name: "UNHRC",
        agenda: "Human rights in conflict zones.",
        seatCount: 10,
        basePrice: 0,
        isPublic: true,
        portfolios: [],
      },
      {
        id: QA_COMMITTEE.AIPPM,
        name: "AIPPM",
        agenda: "National climate policy coordination.",
        seatCount: 3,
        basePrice: 0,
        isPublic: true,
        committeeFormat: "AIPPM",
        portfolios: [
          { id: "pf-qa-bjp", name: "Bharatiya Janata Party", seatCount: 1 },
          { id: "pf-qa-inc", name: "Indian National Congress", seatCount: 1 },
        ],
      },
      {
        id: QA_COMMITTEE.PRESS,
        name: "International Press Corps",
        agenda: "Cover committee proceedings.",
        seatCount: 6,
        basePrice: 0,
        isPublic: true,
        committeeFormat: "PRESS_CORPS",
        portfolios: [
          { id: "pf-qa-press-unsc", name: "UN Security Council", seatCount: 2 },
        ],
      },
    ],
    status: "Published",
    allocationMode: "ALLOT_FIRST",
    paymentDeadlineDays: 7,
    portfolioMatrixVisibility: "PUBLIC",
  };

  await prisma.$transaction(async (tx) => {
    await tx.event.upsert({
      where: { id: QA_EVENT_ID },
      create: {
        id: QA_EVENT_ID,
        title: QA_EVENT_TITLE,
        slug: QA_EVENT_SLUG,
        status: "PUBLISHED",
        startDate,
        endDate,
        timezone: "Asia/Kolkata",
        currency: "INR",
        ownerUserId: organizerUserId,
        deletedAt: null,
      },
      update: {
        title: QA_EVENT_TITLE,
        slug: QA_EVENT_SLUG,
        status: "PUBLISHED",
        startDate,
        endDate,
        timezone: "Asia/Kolkata",
        currency: "INR",
        ownerUserId: organizerUserId,
        deletedAt: null,
      },
    });

    const organizerConfig = await tx.organizerConferenceConfig.upsert({
      where: { eventId: QA_EVENT_ID },
      create: {
        eventId: QA_EVENT_ID,
        description: `${PREVIEW_JSON_PREFIX}${JSON.stringify(previewBlob)}`,
        venue: "QA Convention Centre, Bengaluru, India",
        allocationMode: "ALLOT_FIRST",
        paymentDeadlineDays: 7,
        portfolioMatrixVisibility: "PUBLIC",
        paymentUpi: "qa.test@paytm",
        paymentBankHint: "QA Bank • A/C ****0000",
        paymentNotesMarkdown: "QA test — no real payments.",
      },
      update: {
        description: `${PREVIEW_JSON_PREFIX}${JSON.stringify(previewBlob)}`,
        venue: "QA Convention Centre, Bengaluru, India",
        allocationMode: "ALLOT_FIRST",
        paymentDeadlineDays: 7,
        portfolioMatrixVisibility: "PUBLIC",
      },
    });

    // Reset committees for idempotent re-runs
    const oldCommittees = await tx.committeeConfig.findMany({
      where: { organizerConfigId: organizerConfig.id },
      select: { id: true },
    });
    const oldCommitteeIds = oldCommittees.map((c) => c.id);
    if (oldCommitteeIds.length > 0) {
      await tx.committeeDocument.deleteMany({ where: { committeeId: { in: oldCommitteeIds } } });
      await tx.applicationQuestion.deleteMany({ where: { committeeId: { in: oldCommitteeIds } } });
      await tx.portfolio.deleteMany({ where: { committeeId: { in: oldCommitteeIds } } });
      await tx.committeeConfig.deleteMany({ where: { id: { in: oldCommitteeIds } } });
    }

    await tx.committeeConfig.create({
      data: {
        id: QA_COMMITTEE.UNSC,
        organizerConfigId: organizerConfig.id,
        name: "UN Security Council",
        agenda: "Maintaining international peace in the Middle East.",
        seatCount: 5,
        basePrice: 0,
        visibility: "PUBLIC",
        documents: {
          create: [
            {
              title: "UNSC Background Guide",
              category: "background-guide",
              fileUrl: "https://example.com/qa-unsc-bg.pdf",
            },
          ],
        },
        portfolios: {
          create: [
            { id: QA_PORTFOLIO.USA, name: "United States of America", seatCount: 1 },
            { id: QA_PORTFOLIO.UK, name: "United Kingdom", seatCount: 1 },
            { id: QA_PORTFOLIO.FRANCE, name: "France", seatCount: 1 },
          ],
        },
      },
    });

    await tx.committeeConfig.create({
      data: {
        id: QA_COMMITTEE.UNHRC,
        organizerConfigId: organizerConfig.id,
        name: "UNHRC",
        agenda: "Human rights in conflict zones.",
        seatCount: 10,
        basePrice: 0,
        visibility: "PUBLIC",
      },
    });

    await tx.committeeConfig.create({
      data: {
        id: QA_COMMITTEE.AIPPM,
        organizerConfigId: organizerConfig.id,
        name: "AIPPM",
        agenda: "National climate policy coordination.",
        seatCount: 3,
        committeeFormat: "AIPPM",
        type: "AIPPM",
        visibility: "PUBLIC",
        portfolios: {
          create: [
            { id: "pf-qa-bjp", name: "Bharatiya Janata Party", seatCount: 1 },
            { id: "pf-qa-inc", name: "Indian National Congress", seatCount: 1 },
          ],
        },
      },
    });

    await tx.committeeConfig.create({
      data: {
        id: QA_COMMITTEE.PRESS,
        organizerConfigId: organizerConfig.id,
        name: "International Press Corps",
        agenda: "Cover committee proceedings.",
        seatCount: 6,
        committeeFormat: "PRESS_CORPS",
        type: "International Press",
        visibility: "PUBLIC",
        portfolios: {
          create: [{ id: "pf-qa-press-unsc", name: "UN Security Council", seatCount: 2 }],
        },
      },
    });

    await tx.registrationCategoryConfig.deleteMany({
      where: { organizerConfigId: organizerConfig.id },
    });

    await tx.registrationCategoryConfig.createMany({
      data: [
        {
          categoryKey: QA_CATEGORY.DELEGATE,
          organizerConfigId: organizerConfig.id,
          name: "Delegate Registration",
          applicationType: "delegate",
          description: "Individual delegate — free for QA.",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: true,
          registrationDeadline,
        },
        {
          categoryKey: QA_CATEGORY.CHAIR,
          organizerConfigId: organizerConfig.id,
          name: "Chair Registration",
          applicationType: "chair",
          description: "Executive board applications.",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: false,
        },
        {
          categoryKey: QA_CATEGORY.PRESS,
          organizerConfigId: organizerConfig.id,
          name: "Press Registration",
          applicationType: "press",
          description: "International Press Corps.",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: true,
        },
        {
          categoryKey: QA_CATEGORY.DELEGATION,
          organizerConfigId: organizerConfig.id,
          name: "Delegation Registration",
          applicationType: "delegation",
          description: "School delegation head.",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: false,
          maxDelegatesPerDelegation: 8,
        },
        {
          categoryKey: QA_CATEGORY.CLOSED,
          organizerConfigId: organizerConfig.id,
          name: "Closed Category (QA)",
          applicationType: "delegate",
          description: "Deadline passed.",
          isOpen: true,
          basePrice: 0,
          requiresCommitteeSelection: false,
          registrationDeadline: pastDeadline,
        },
      ],
    });

    await tx.eventTeamMember.upsert({
      where: { eventId_userId: { eventId: QA_EVENT_ID, userId: organizerUserId } },
      create: {
        eventId: QA_EVENT_ID,
        userId: organizerUserId,
        role: "LEAD_ORGANIZER",
        acceptedAt: now,
      },
      update: { role: "LEAD_ORGANIZER", acceptedAt: now },
    });
  });

  await mergeOrganizerStoredBlob(QA_EVENT_ID, {
    status: "Published",
    adminModeratedAt: now.toISOString(),
    adminModeratedBy: "qa-mock-mun-script",
  });

  try {
    revalidateTag(MARKETPLACE_CACHE_TAG, { expire: 0 });
  } catch {
    // non-blocking when run outside Next request
  }

  await prisma.$disconnect();

  return {
    eventId: QA_EVENT_ID,
    slug: QA_EVENT_SLUG,
    committeeIds: QA_COMMITTEE,
    categoryIds: QA_CATEGORY,
    portfolioIds: QA_PORTFOLIO,
    organizerUserId,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  setupMockMunConference()
    .then((result) => {
      console.log("Mock MUN conference setup OK:", result);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
