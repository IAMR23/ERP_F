ALTER TABLE "CatalogItem"
ADD COLUMN "branchId" UUID,
ADD COLUMN "model" TEXT,
ADD COLUMN "unitPrice" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "pvp" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "finalPrice" DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE "CatalogItem" AS item
SET
  "branchId" = branch."id",
  "unitPrice" = item."cost",
  "pvp" = item."salePrice",
  "finalPrice" = item."salePrice"
FROM (
  SELECT DISTINCT ON ("tenantId") "tenantId", "id"
  FROM "Branch"
  WHERE "status" = 'ACTIVE'
  ORDER BY "tenantId", "createdAt" ASC
) AS branch
WHERE branch."tenantId" = item."tenantId";

ALTER TABLE "CatalogItem"
ALTER COLUMN "branchId" SET NOT NULL;

CREATE INDEX "CatalogItem_tenantId_branchId_status_idx" ON "CatalogItem"("tenantId", "branchId", "status");

ALTER TABLE "CatalogItem"
ADD CONSTRAINT "CatalogItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
