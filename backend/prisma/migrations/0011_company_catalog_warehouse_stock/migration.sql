DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Warehouse'
      AND column_name = 'isMain'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Warehouse'
      AND column_name = 'isDefault'
  ) THEN
    ALTER TABLE "Warehouse" RENAME COLUMN "isMain" TO "isDefault";
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Warehouse'
      AND column_name = 'isDefault'
  ) THEN
    ALTER TABLE "Warehouse" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'StockTransfer'
      AND column_name = 'sourceBranchId'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM "StockTransfer" transfer
      JOIN "Warehouse" source_warehouse
        ON source_warehouse."id" = transfer."sourceWarehouseId"
      JOIN "Warehouse" destination_warehouse
        ON destination_warehouse."id" = transfer."destinationWarehouseId"
      WHERE transfer."sourceBranchId" IS DISTINCT FROM source_warehouse."branchId"
         OR transfer."destinationBranchId" IS DISTINCT FROM destination_warehouse."branchId"
    ) THEN
      RAISE EXCEPTION 'StockTransfer branch columns contain values that differ from their warehouses. Fix data before applying migration 0011.';
    END IF;
  END IF;
END $$;

ALTER TABLE "CatalogItem" DROP CONSTRAINT IF EXISTS "CatalogItem_branchId_fkey";
DROP INDEX IF EXISTS "CatalogItem_tenantId_branchId_status_idx";
ALTER TABLE "CatalogItem" DROP COLUMN IF EXISTS "branchId";

ALTER TABLE "StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_sourceBranchId_fkey";
ALTER TABLE "StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_destinationBranchId_fkey";
ALTER TABLE "StockTransfer"
  DROP COLUMN IF EXISTS "sourceBranchId",
  DROP COLUMN IF EXISTS "destinationBranchId";

CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_one_active_default_per_branch_key"
  ON "Warehouse"("tenantId", "branchId")
  WHERE "isDefault" = true AND "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "Warehouse_tenantId_branchId_isDefault_status_idx"
  ON "Warehouse"("tenantId", "branchId", "isDefault", "status");
