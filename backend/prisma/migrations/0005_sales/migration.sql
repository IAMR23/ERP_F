ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALE_VOIDED';

ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'SALE_OUT';
ALTER TYPE "InventorySourceType" ADD VALUE IF NOT EXISTS 'SALE';

CREATE TYPE "CustomerType" AS ENUM ('WHOLESALE', 'RETAIL', 'FINAL_CONSUMER');
CREATE TYPE "SaleStatus" AS ENUM ('CONFIRMED', 'VOIDED');

CREATE TABLE "TaxRate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ratePercent" DECIMAL(5, 2) NOT NULL,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TaxRate" ("tenantId", "code", "name", "ratePercent")
SELECT "id", 'IVA_15', 'IVA 15%', 15.00 FROM "Tenant"
ON CONFLICT DO NOTHING;

INSERT INTO "TaxRate" ("tenantId", "code", "name", "ratePercent")
SELECT "id", 'IVA_5', 'IVA 5%', 5.00 FROM "Tenant"
ON CONFLICT DO NOTHING;

INSERT INTO "TaxRate" ("tenantId", "code", "name", "ratePercent")
SELECT "id", 'IVA_0', 'Sin IVA', 0.00 FROM "Tenant"
ON CONFLICT DO NOTHING;

ALTER TABLE "Person"
ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'FINAL_CONSUMER';

ALTER TABLE "CatalogItem"
ALTER COLUMN "taxRateId" DROP DEFAULT,
ALTER COLUMN "taxRateId" TYPE UUID USING (
  CASE
    WHEN "taxRateId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN "taxRateId"::uuid
    ELSE NULL
  END
);

UPDATE "CatalogItem" AS item
SET "taxRateId" = tax."id"
FROM "TaxRate" AS tax
WHERE tax."tenantId" = item."tenantId"
  AND tax."code" = 'IVA_15'
  AND item."taxRateId" IS NULL;

CREATE TABLE "Sale" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "customerId" UUID,
  "customerType" "CustomerType" NOT NULL DEFAULT 'FINAL_CONSUMER',
  "status" "SaleStatus" NOT NULL DEFAULT 'CONFIRMED',
  "documentNumber" TEXT,
  "reference" TEXT,
  "description" TEXT,
  "subtotal" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "discountRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "taxableSubtotal" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "total" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "correlationId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "createdBy" UUID NOT NULL,
  "voidedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "saleId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "taxRateId" UUID,
  "quantity" DECIMAL(18, 4) NOT NULL,
  "unitPrice" DECIMAL(18, 6) NOT NULL,
  "discountRate" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "netSubtotal" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "taxRatePercent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  "stockUnitCost" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxRate_tenantId_code_key" ON "TaxRate"("tenantId", "code");
CREATE INDEX "TaxRate_tenantId_status_idx" ON "TaxRate"("tenantId", "status");
CREATE INDEX "Sale_tenantId_companyId_status_idx" ON "Sale"("tenantId", "companyId", "status");
CREATE INDEX "Sale_tenantId_warehouseId_createdAt_idx" ON "Sale"("tenantId", "warehouseId", "createdAt");
CREATE INDEX "Sale_tenantId_customerId_idx" ON "Sale"("tenantId", "customerId");
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");
CREATE INDEX "SaleLine_catalogItemId_idx" ON "SaleLine"("catalogItemId");

ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_voidedBy_fkey" FOREIGN KEY ("voidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
