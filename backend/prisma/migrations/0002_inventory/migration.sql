ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPLIER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPLIER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPPLIER_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WAREHOUSE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WAREHOUSE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WAREHOUSE_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_ENTRY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_ENTRY_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_DISPATCHED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTMENT_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_COUNT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_COUNT_APPROVED';

CREATE TYPE "SupplierIdentificationType" AS ENUM ('RUC', 'CEDULA', 'PASSPORT', 'OTHER');
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_ENTRY', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'STOCK_COUNT_IN', 'STOCK_COUNT_OUT');
CREATE TYPE "InventorySourceType" AS ENUM ('STOCK_ENTRY', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT', 'STOCK_COUNT');
CREATE TYPE "StockEntryType" AS ENUM ('PURCHASE_INVOICE', 'MANUAL', 'OPENING_BALANCE');
CREATE TYPE "StockEntryStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "StockAdjustmentStatus" AS ENUM ('DRAFT', 'CONFIRMED');
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED');

CREATE TABLE "Supplier" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "fiscalId" TEXT NOT NULL,
  "identificationType" "SupplierIdentificationType" NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warehouse" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isMain" BOOLEAN NOT NULL DEFAULT false,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockBalance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "onHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "averageCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "type" "InventoryMovementType" NOT NULL,
  "quantityIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "quantityOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "previousOnHand" DECIMAL(18,4) NOT NULL,
  "nextOnHand" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,6) NOT NULL,
  "totalCost" DECIMAL(18,6) NOT NULL,
  "sourceType" "InventorySourceType" NOT NULL,
  "sourceId" UUID NOT NULL,
  "reference" TEXT,
  "correlationId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "responsibleUserId" UUID NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockEntry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "supplierId" UUID,
  "type" "StockEntryType" NOT NULL,
  "status" "StockEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "documentNumber" TEXT,
  "documentDate" TIMESTAMP(3),
  "fiscalAuth" TEXT,
  "reference" TEXT,
  "reason" TEXT,
  "correlationId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "confirmedAt" TIMESTAMP(3),
  "createdBy" UUID NOT NULL,
  "confirmedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockEntryLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stockEntryId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,6) NOT NULL,
  "totalCost" DECIMAL(18,6) NOT NULL,
  CONSTRAINT "StockEntryLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockTransfer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sourceBranchId" UUID NOT NULL,
  "sourceWarehouseId" UUID NOT NULL,
  "destinationBranchId" UUID NOT NULL,
  "destinationWarehouseId" UUID NOT NULL,
  "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" TEXT,
  "reason" TEXT,
  "correlationId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "requestedBy" UUID,
  "requestedAt" TIMESTAMP(3),
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP(3),
  "dispatchedBy" UUID,
  "dispatchedAt" TIMESTAMP(3),
  "receivedBy" UUID,
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockTransferLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stockTransferId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockAdjustment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "correlationId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "createdBy" UUID NOT NULL,
  "confirmedBy" UUID,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockAdjustmentLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stockAdjustmentId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "difference" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  CONSTRAINT "StockAdjustmentLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockCount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" TEXT,
  "correlationId" UUID NOT NULL DEFAULT gen_random_uuid(),
  "adjustmentId" UUID,
  "createdBy" UUID NOT NULL,
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockCountLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stockCountId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "expectedQty" DECIMAL(18,4) NOT NULL,
  "physicalQty" DECIMAL(18,4) NOT NULL,
  "difference" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_companyId_fiscalId_key" ON "Supplier"("companyId", "fiscalId");
CREATE INDEX "Supplier_tenantId_companyId_status_idx" ON "Supplier"("tenantId", "companyId", "status");
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");
CREATE INDEX "Warehouse_tenantId_companyId_branchId_status_idx" ON "Warehouse"("tenantId", "companyId", "branchId", "status");
CREATE UNIQUE INDEX "StockBalance_tenantId_warehouseId_catalogItemId_key" ON "StockBalance"("tenantId", "warehouseId", "catalogItemId");
CREATE INDEX "StockBalance_tenantId_companyId_branchId_idx" ON "StockBalance"("tenantId", "companyId", "branchId");
CREATE INDEX "StockBalance_tenantId_catalogItemId_idx" ON "StockBalance"("tenantId", "catalogItemId");
CREATE UNIQUE INDEX "InventoryMovement_tenantId_idempotencyKey_key" ON "InventoryMovement"("tenantId", "idempotencyKey");
CREATE INDEX "InventoryMovement_tenantId_catalogItemId_createdAt_idx" ON "InventoryMovement"("tenantId", "catalogItemId", "createdAt");
CREATE INDEX "InventoryMovement_tenantId_warehouseId_createdAt_idx" ON "InventoryMovement"("tenantId", "warehouseId", "createdAt");
CREATE INDEX "InventoryMovement_sourceType_sourceId_idx" ON "InventoryMovement"("sourceType", "sourceId");
CREATE INDEX "StockEntry_tenantId_companyId_status_idx" ON "StockEntry"("tenantId", "companyId", "status");
CREATE INDEX "StockEntry_tenantId_warehouseId_createdAt_idx" ON "StockEntry"("tenantId", "warehouseId", "createdAt");
CREATE INDEX "StockEntryLine_catalogItemId_idx" ON "StockEntryLine"("catalogItemId");
CREATE INDEX "StockTransfer_tenantId_companyId_status_idx" ON "StockTransfer"("tenantId", "companyId", "status");
CREATE INDEX "StockTransfer_tenantId_sourceWarehouseId_idx" ON "StockTransfer"("tenantId", "sourceWarehouseId");
CREATE INDEX "StockTransfer_tenantId_destinationWarehouseId_idx" ON "StockTransfer"("tenantId", "destinationWarehouseId");
CREATE INDEX "StockTransferLine_catalogItemId_idx" ON "StockTransferLine"("catalogItemId");
CREATE INDEX "StockAdjustment_tenantId_companyId_status_idx" ON "StockAdjustment"("tenantId", "companyId", "status");
CREATE INDEX "StockAdjustment_tenantId_warehouseId_createdAt_idx" ON "StockAdjustment"("tenantId", "warehouseId", "createdAt");
CREATE INDEX "StockAdjustmentLine_catalogItemId_idx" ON "StockAdjustmentLine"("catalogItemId");
CREATE UNIQUE INDEX "StockCount_adjustmentId_key" ON "StockCount"("adjustmentId");
CREATE INDEX "StockCount_tenantId_companyId_status_idx" ON "StockCount"("tenantId", "companyId", "status");
CREATE INDEX "StockCount_tenantId_warehouseId_createdAt_idx" ON "StockCount"("tenantId", "warehouseId", "createdAt");
CREATE INDEX "StockCountLine_catalogItemId_idx" ON "StockCountLine"("catalogItemId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockEntryLine" ADD CONSTRAINT "StockEntryLine_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "StockEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockEntryLine" ADD CONSTRAINT "StockEntryLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_dispatchedBy_fkey" FOREIGN KEY ("dispatchedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
