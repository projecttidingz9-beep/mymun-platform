/**
 * Idempotent upsert of a published ₹10 test conference for Cashfree E2E.
 * Safe on production — does not wipe other data.
 *
 * Usage (DATABASE_URL in .env.local):
 *   npm run create:cashfree-test-mun
 *
 * Optional: CASHFREE_TEST_ORGANIZER_EMAIL=organizer1@tidingz.demo
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config();

const EVENT_ID = "evt-cashfree-test-mun";
const SLUG = "cashfree-test-mun";
const COMMITTEE_ID = "cmte-cashfree-test-unga";
const CATEGORY_KEY = "cat-delegate";
const PRICE = 10;
const PREVIEW_JSON_PREFIX = "__preview_json__:";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required (set in .env.local).");
    process.exit(1);
  }

  const organizerEmail = (
    process.env.CASHFREE_TEST_ORGANIZER_EMAIL || "organizer1@tidingz.demo"
  )
    .trim()
    .toLowerCase();

  const { prisma } = await import("../src/lib/server/prisma");

  const organizer = await prisma.user.findUnique({
    where: { email: organizerEmail },
    select: { id: true, name: true, email: true },
  });

  if (!organizer) {
    console.error(
      `Organizer not found: ${organizerEmail}. Seed the DB or set CASHFREE_TEST_ORGANIZER_EMAIL.`
    );
    process.exit(1);
  }

  const now = new Date();
  const startDate = addMonths(now, 3);
  startDate.setHours(9, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2);
  endDate.setHours(18, 0, 0, 0);
  const registrationDeadline = addMonths(now, 2);

  const previewBlob = {
    title: "Cashfree Test MUN",
    city: "Mumbai",
    country: "India",
    organizerName: organizer.name || "Organizer",
    description:
      "Low-cost test conference for Cashfree payment verification. Delegate registration is ₹10 only.",
    registrationDeadline: isoDateOnly(registrationDeadline),
    level: "University",
    tags: ["Test", "Cashfree"],
    registrationCategories: [
      {
        id: CATEGORY_KEY,
        name: "Delegate",
        description: "Cashfree test delegate registration",
        applicationType: "delegate",
        isOpen: true,
        basePrice: PRICE,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases: [],
      },
    ],
  };

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.upsert({
      where: { id: EVENT_ID },
      create: {
        id: EVENT_ID,
        title: "Cashfree Test MUN",
        slug: SLUG,
        status: "PUBLISHED",
        startDate,
        endDate,
        timezone: "Asia/Kolkata",
        currency: "INR",
        ownerUserId: organizer.id,
        deletedAt: null,
      },
      update: {
        title: "Cashfree Test MUN",
        slug: SLUG,
        status: "PUBLISHED",
        startDate,
        endDate,
        timezone: "Asia/Kolkata",
        currency: "INR",
        ownerUserId: organizer.id,
        deletedAt: null,
      },
    });

    const organizerConfig = await tx.organizerConferenceConfig.upsert({
      where: { eventId: EVENT_ID },
      create: {
        eventId: EVENT_ID,
        description: `${PREVIEW_JSON_PREFIX}${JSON.stringify(previewBlob)}`,
        venue: "Test Venue, Mumbai, India",
        paymentNotesMarkdown: "Cashfree test conference — ₹10 delegate fee.",
      },
      update: {
        description: `${PREVIEW_JSON_PREFIX}${JSON.stringify(previewBlob)}`,
        venue: "Test Venue, Mumbai, India",
        paymentNotesMarkdown: "Cashfree test conference — ₹10 delegate fee.",
      },
    });

    await tx.pricingPhaseConfig.deleteMany({
      where: { organizerConfigId: organizerConfig.id },
    });

    const committee = await tx.committeeConfig.upsert({
      where: { id: COMMITTEE_ID },
      create: {
        id: COMMITTEE_ID,
        organizerConfigId: organizerConfig.id,
        name: "UN General Assembly",
        agenda: "Test committee for Cashfree payment flow.",
        seatCount: 50,
        basePrice: PRICE,
        visibility: "PUBLIC",
      },
      update: {
        organizerConfigId: organizerConfig.id,
        name: "UN General Assembly",
        agenda: "Test committee for Cashfree payment flow.",
        seatCount: 50,
        basePrice: PRICE,
        visibility: "PUBLIC",
      },
    });

    const existingCategory = await tx.registrationCategoryConfig.findUnique({
      where: {
        organizerConfigId_categoryKey: {
          organizerConfigId: organizerConfig.id,
          categoryKey: CATEGORY_KEY,
        },
      },
    });

    const category = existingCategory
      ? await tx.registrationCategoryConfig.update({
          where: { id: existingCategory.id },
          data: {
            name: "Delegate",
            applicationType: "delegate",
            description: "Cashfree test delegate registration",
            isOpen: true,
            basePrice: PRICE,
            requiresCommitteeSelection: true,
            registrationDeadline,
          },
        })
      : await tx.registrationCategoryConfig.create({
          data: {
            categoryKey: CATEGORY_KEY,
            organizerConfigId: organizerConfig.id,
            name: "Delegate",
            applicationType: "delegate",
            description: "Cashfree test delegate registration",
            isOpen: true,
            basePrice: PRICE,
            requiresCommitteeSelection: true,
            registrationDeadline,
          },
        });

    return { event, organizerConfig, committee, category };
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://tidingz.com";

  console.log("\nCashfree test conference ready.\n");
  console.log(`  Event ID:     ${result.event.id}`);
  console.log(`  Slug:         ${SLUG}`);
  console.log(`  Price:        ₹${PRICE}`);
  console.log(`  Organizer:    ${organizer.email}`);
  console.log(`  Committee:    ${result.committee.name} (${result.committee.id})`);
  console.log(`  Category:     ${result.category.name} (${CATEGORY_KEY})`);
  console.log("\nURLs:");
  console.log(`  Marketplace:  ${appUrl}/conferences`);
  console.log(`  Conference:   ${appUrl}/conference/${EVENT_ID}`);
  console.log(`  Checkout:     ${appUrl}/checkout/${SLUG}`);
  console.log("\nTest delegate (if seeded): delegate5@tidingz.demo / TidingzDemo1");
  console.log("Sandbox card: 4111111111111111, CVV 123, any future expiry.\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
