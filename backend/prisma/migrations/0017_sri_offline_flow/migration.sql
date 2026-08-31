ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "specialContributorResolution" TEXT,
ADD COLUMN IF NOT EXISTS "withholdingAgentResolution" TEXT,
ADD COLUMN IF NOT EXISTS "largeTaxpayerResolution" TEXT,
ADD COLUMN IF NOT EXISTS "sriSoftwareProviderRuc" TEXT;

ALTER TABLE "Sale"
ADD COLUMN IF NOT EXISTS "sriUnsignedXml" TEXT,
ADD COLUMN IF NOT EXISTS "sriReceptionResponse" TEXT,
ADD COLUMN IF NOT EXISTS "sriAuthorizationXml" TEXT,
ADD COLUMN IF NOT EXISTS "sriMessages" JSONB;

UPDATE "Sale"
SET "sriUnsignedXml" = "sriXml"
WHERE "sriUnsignedXml" IS NULL
  AND "sriXml" IS NOT NULL
  AND "sriXml" NOT ILIKE '%<Signature%';

CREATE INDEX IF NOT EXISTS "Sale_tenantId_companyId_sriAccessKey_idx"
ON "Sale"("tenantId", "companyId", "sriAccessKey");
