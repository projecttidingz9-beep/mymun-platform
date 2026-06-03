-- Registration preferences + categories + portfolios + awards + certificates

ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "portfolioId" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "committeePreferencesJson" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "portfolioPreferencesJson" TEXT;

CREATE TABLE IF NOT EXISTS "Portfolio" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Portfolio_committeeId_name_key" ON "Portfolio"("committeeId", "name");
CREATE INDEX IF NOT EXISTS "Portfolio_committeeId_idx" ON "Portfolio"("committeeId");

ALTER TABLE "Portfolio" DROP CONSTRAINT IF EXISTS "Portfolio_committeeId_fkey";
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "CommitteeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_portfolioId_fkey";
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Registration_portfolioId_idx" ON "Registration"("portfolioId");
CREATE INDEX IF NOT EXISTS "Registration_eventId_committeeName_portfolioName_status_idx" ON "Registration"("eventId", "committeeName", "portfolioName", "status");

CREATE TABLE IF NOT EXISTS "RegistrationCategoryConfig" (
    "id" TEXT NOT NULL,
    "organizerConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "applicationType" TEXT NOT NULL DEFAULT 'delegate',
    "description" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "basePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "requiresCommitteeSelection" BOOLEAN NOT NULL DEFAULT true,
    "registrationDeadline" TIMESTAMP(3),
    "maxDelegatesPerDelegation" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RegistrationCategoryConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegistrationCategoryConfig_organizerConfigId_id_key" ON "RegistrationCategoryConfig"("organizerConfigId", "id");
CREATE INDEX IF NOT EXISTS "RegistrationCategoryConfig_organizerConfigId_idx" ON "RegistrationCategoryConfig"("organizerConfigId");

ALTER TABLE "RegistrationCategoryConfig" DROP CONSTRAINT IF EXISTS "RegistrationCategoryConfig_organizerConfigId_fkey";
ALTER TABLE "RegistrationCategoryConfig" ADD CONSTRAINT "RegistrationCategoryConfig_organizerConfigId_fkey" FOREIGN KEY ("organizerConfigId") REFERENCES "OrganizerConferenceConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConferenceAward" ADD COLUMN IF NOT EXISTS "sponsorName" TEXT;
ALTER TABLE "ConferenceAward" ADD COLUMN IF NOT EXISTS "recipientRegistrationId" TEXT;
ALTER TABLE "ConferenceAward" ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT;
ALTER TABLE "ConferenceAward" ADD COLUMN IF NOT EXISTS "participantName" TEXT;

CREATE INDEX IF NOT EXISTS "ConferenceAward_recipientRegistrationId_idx" ON "ConferenceAward"("recipientRegistrationId");

CREATE TABLE IF NOT EXISTS "ParticipationCertificate" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "issuedByUserId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParticipationCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParticipationCertificate_registrationId_key" ON "ParticipationCertificate"("registrationId");
CREATE INDEX IF NOT EXISTS "ParticipationCertificate_eventId_idx" ON "ParticipationCertificate"("eventId");

ALTER TABLE "ParticipationCertificate" DROP CONSTRAINT IF EXISTS "ParticipationCertificate_registrationId_fkey";
ALTER TABLE "ParticipationCertificate" ADD CONSTRAINT "ParticipationCertificate_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParticipationCertificate" DROP CONSTRAINT IF EXISTS "ParticipationCertificate_eventId_fkey";
ALTER TABLE "ParticipationCertificate" ADD CONSTRAINT "ParticipationCertificate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "formAnswersJson" TEXT;
