-- One review per user per event (keep oldest by createdAt)
DELETE FROM "ConferenceReview" cr
WHERE cr.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "eventId", "userId" ORDER BY "createdAt" ASC) AS rn
    FROM "ConferenceReview"
  ) sub
  WHERE rn > 1
);

CREATE UNIQUE INDEX "ConferenceReview_eventId_userId_key" ON "ConferenceReview"("eventId", "userId");

-- At most one active (non-deleted) registration per user per event
CREATE UNIQUE INDEX "Registration_userId_eventId_active_key" ON "Registration"("userId", "eventId") WHERE "deletedAt" IS NULL;

-- Fixed-precision money (INR-friendly scale)
ALTER TABLE "Registration" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "PaymentIntent" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "CommitteeConfig" ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(12,2) USING (
  CASE WHEN "basePrice" IS NULL THEN NULL ELSE ROUND("basePrice"::numeric, 2) END
);
ALTER TABLE "PricingPhaseConfig" ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(12,2) USING ROUND("basePrice"::numeric, 2);
