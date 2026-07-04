-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "OrganizerConferenceConfig" ADD COLUMN     "invoiceTemplateFileName" TEXT,
ADD COLUMN     "invoiceTemplateUrl" TEXT;
