ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'PENDING_DELIVERY';

DO $$
BEGIN
  CREATE TYPE "SaleDocumentType" AS ENUM ('INVOICE', 'SALES_NOTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Sale"
ADD COLUMN IF NOT EXISTS "documentType" "SaleDocumentType" NOT NULL DEFAULT 'INVOICE',
ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "dueDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "delivered" BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deliveredBy" UUID,
ADD COLUMN IF NOT EXISTS "establishmentCode" TEXT NOT NULL DEFAULT '001',
ADD COLUMN IF NOT EXISTS "emissionPoint" TEXT NOT NULL DEFAULT '001',
ADD COLUMN IF NOT EXISTS "sequential" INTEGER,
ADD COLUMN IF NOT EXISTS "purchaseOrder" TEXT;

UPDATE "Sale" AS sale
SET "establishmentCode" = branch."sriEstablishmentCode"
FROM "Branch" AS branch
WHERE branch."id" = sale."branchId"
  AND sale."establishmentCode" = '001';

UPDATE "Sale"
SET "deliveredAt" = COALESCE("deliveredAt", "confirmedAt")
WHERE "delivered" = TRUE;

CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalePayment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "saleId" UUID NOT NULL,
  "paymentMethodId" UUID NOT NULL,
  "amount" DECIMAL(18, 6) NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SaleDocumentSequence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "documentType" "SaleDocumentType" NOT NULL,
  "establishmentCode" TEXT NOT NULL,
  "emissionPoint" TEXT NOT NULL,
  "currentNumber" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleDocumentSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentMethod_tenantId_code_key" ON "PaymentMethod"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "PaymentMethod_tenantId_status_idx" ON "PaymentMethod"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "SalePayment_saleId_idx" ON "SalePayment"("saleId");
CREATE INDEX IF NOT EXISTS "SalePayment_paymentMethodId_idx" ON "SalePayment"("paymentMethodId");
CREATE UNIQUE INDEX IF NOT EXISTS "SaleDocumentSequence_tenantId_companyId_documentType_establishmentCode_emissionPoint_key" ON "SaleDocumentSequence"("tenantId", "companyId", "documentType", "establishmentCode", "emissionPoint");
CREATE INDEX IF NOT EXISTS "SaleDocumentSequence_tenantId_companyId_documentType_idx" ON "SaleDocumentSequence"("tenantId", "companyId", "documentType");
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_tenantId_companyId_documentType_documentNumber_key" ON "Sale"("tenantId", "companyId", "documentType", "documentNumber");

DO $$
BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_deliveredBy_fkey" FOREIGN KEY ("deliveredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SaleDocumentSequence" ADD CONSTRAINT "SaleDocumentSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SaleDocumentSequence" ADD CONSTRAINT "SaleDocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "PaymentMethod" ("tenantId", "code", "name", "status")
SELECT "id", 'CASH', 'Efectivo', 'ACTIVE'::"EntityStatus"
FROM "Tenant"
ON CONFLICT ("tenantId", "code") DO UPDATE
SET "name" = EXCLUDED."name",
    "status" = 'ACTIVE'::"EntityStatus";
