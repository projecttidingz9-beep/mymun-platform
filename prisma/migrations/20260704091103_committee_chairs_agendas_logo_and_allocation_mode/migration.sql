-- CreateEnum
CREATE TYPE "AllocationMode" AS ENUM ('PAY_FIRST', 'ALLOT_FIRST');

-- AlterTable
ALTER TABLE "CommitteeConfig" ADD COLUMN     "agendasJson" TEXT,
ADD COLUMN     "chairsJson" TEXT,
ADD COLUMN     "logoImageUrl" TEXT,
ADD COLUMN     "noPortfolio" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrganizerConferenceConfig" ADD COLUMN     "allocationMode" "AllocationMode",
ADD COLUMN     "paymentDeadlineDays" INTEGER,
ADD COLUMN     "portfolioMatrixVisibility" "CommitteeVisibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "allotmentDeclinedAt" TIMESTAMP(3),
ADD COLUMN     "paymentDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "released" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ParticipationCertificate" ADD CONSTRAINT "ParticipationCertificate_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
