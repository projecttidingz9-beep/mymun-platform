-- Indian MUN feature pack

CREATE TYPE "PositionPaperStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "DelegationStatus" AS ENUM ('OPEN', 'CLOSED');

ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "countryPreferencesJson" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "delegationId" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "isDelegationHead" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ConferenceAward" ADD COLUMN IF NOT EXISTS "presetKey" TEXT;
ALTER TABLE "ConferenceAward" ADD COLUMN IF NOT EXISTS "recipientDelegationId" TEXT;

ALTER TABLE "CommitteeConfig" ADD COLUMN IF NOT EXISTS "committeeFormat" TEXT;
ALTER TABLE "CommitteeConfig" ADD COLUMN IF NOT EXISTS "metadataJson" TEXT;
ALTER TABLE "CommitteeConfig" ADD COLUMN IF NOT EXISTS "positionPaperDeadline" TIMESTAMP(3);

ALTER TABLE "Delegation" ADD COLUMN IF NOT EXISTS "schoolName" TEXT;
ALTER TABLE "Delegation" ADD COLUMN IF NOT EXISTS "maxMembers" INTEGER;
ALTER TABLE "Delegation" ADD COLUMN IF NOT EXISTS "status" "DelegationStatus" NOT NULL DEFAULT 'OPEN';

CREATE TABLE IF NOT EXISTS "PositionPaper" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "textContent" TEXT,
    "status" "PositionPaperStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "PositionPaper_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PositionPaper_registrationId_committeeId_key" ON "PositionPaper"("registrationId", "committeeId");
CREATE INDEX IF NOT EXISTS "PositionPaper_eventId_idx" ON "PositionPaper"("eventId");
CREATE INDEX IF NOT EXISTS "PositionPaper_committeeId_idx" ON "PositionPaper"("committeeId");

ALTER TABLE "PositionPaper" DROP CONSTRAINT IF EXISTS "PositionPaper_registrationId_fkey";
ALTER TABLE "PositionPaper" ADD CONSTRAINT "PositionPaper_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PositionPaper" DROP CONSTRAINT IF EXISTS "PositionPaper_eventId_fkey";
ALTER TABLE "PositionPaper" ADD CONSTRAINT "PositionPaper_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PositionPaper" DROP CONSTRAINT IF EXISTS "PositionPaper_committeeId_fkey";
ALTER TABLE "PositionPaper" ADD CONSTRAINT "PositionPaper_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "CommitteeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CommitteeDocument" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "version" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommitteeDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommitteeDocument_committeeId_idx" ON "CommitteeDocument"("committeeId");

ALTER TABLE "CommitteeDocument" DROP CONSTRAINT IF EXISTS "CommitteeDocument_committeeId_fkey";
ALTER TABLE "CommitteeDocument" ADD CONSTRAINT "CommitteeDocument_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "CommitteeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DocumentAcknowledgment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAcknowledgment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentAcknowledgment_registrationId_documentId_key" ON "DocumentAcknowledgment"("registrationId", "documentId");

ALTER TABLE "DocumentAcknowledgment" DROP CONSTRAINT IF EXISTS "DocumentAcknowledgment_registrationId_fkey";
ALTER TABLE "DocumentAcknowledgment" ADD CONSTRAINT "DocumentAcknowledgment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAcknowledgment" DROP CONSTRAINT IF EXISTS "DocumentAcknowledgment_documentId_fkey";
ALTER TABLE "DocumentAcknowledgment" ADD CONSTRAINT "DocumentAcknowledgment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CommitteeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_delegationId_fkey";
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Registration_delegationId_idx" ON "Registration"("delegationId");
