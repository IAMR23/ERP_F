ALTER TABLE "Sale"
ADD COLUMN IF NOT EXISTS "sriSignedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sriSignatureError" TEXT,
ADD COLUMN IF NOT EXISTS "sriReceptionError" TEXT,
ADD COLUMN IF NOT EXISTS "sriAuthorizationError" TEXT,
ADD COLUMN IF NOT EXISTS "customerEmailSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "customerEmailLastSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "customerEmailLastAttemptAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "customerEmailSendingAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "customerEmailRecipient" TEXT,
ADD COLUMN IF NOT EXISTS "customerEmailError" TEXT,
ADD COLUMN IF NOT EXISTS "customerEmailAttemptCount" INTEGER NOT NULL DEFAULT 0;

-- Conserva compatibilidad con facturas firmadas antes de esta migracion.
UPDATE "Sale"
SET "sriSignedAt" = COALESCE("sriGeneratedAt", "updatedAt")
WHERE "documentType" = 'INVOICE'
  AND "sriSignedAt" IS NULL
  AND "sriXml" ILIKE '%<Signature%';

UPDATE "Sale"
SET "customerEmailLastSentAt" = "customerEmailSentAt"
WHERE "customerEmailSentAt" IS NOT NULL
  AND "customerEmailLastSentAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Sale_tenantId_companyId_customerEmailSentAt_idx"
ON "Sale"("tenantId", "companyId", "customerEmailSentAt");
