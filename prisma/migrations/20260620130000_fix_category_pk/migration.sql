-- Fix RegistrationCategoryConfig PK collision: business keys (cat-delegate, etc.)
-- were stored as global primary keys and conflicted across conferences.

ALTER TABLE "RegistrationCategoryConfig"
  ADD COLUMN IF NOT EXISTS "categoryKey" TEXT;

UPDATE "RegistrationCategoryConfig"
  SET "categoryKey" = "id"
  WHERE "categoryKey" IS NULL;

ALTER TABLE "RegistrationCategoryConfig"
  ALTER COLUMN "categoryKey" SET NOT NULL;

DROP INDEX IF EXISTS "RegistrationCategoryConfig_organizerConfigId_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "RegistrationCategoryConfig_organizerConfigId_categoryKey_key"
  ON "RegistrationCategoryConfig"("organizerConfigId", "categoryKey");
