-- Deterministic QR: store nonce used to sign pass tokens
ALTER TABLE "DelegatePass" ADD COLUMN IF NOT EXISTS "qrNonce" TEXT;

UPDATE "DelegatePass" SET "qrNonce" = gen_random_uuid()::text WHERE "qrNonce" IS NULL;

ALTER TABLE "DelegatePass" ALTER COLUMN "qrNonce" SET NOT NULL;
