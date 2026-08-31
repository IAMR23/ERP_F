ALTER TABLE "CatalogItem"
ADD COLUMN "companyId" UUID,
ADD COLUMN "pvp1" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "pvp2" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "pvp3" DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE "CatalogItem" AS item
SET
  "companyId" = branch."companyId",
  "pvp1" = item."pvp",
  "pvp2" = item."pvp",
  "pvp3" = item."pvp"
FROM "Branch" AS branch
WHERE branch."id" = item."branchId";

ALTER TABLE "CatalogItem"
ALTER COLUMN "companyId" SET NOT NULL;

CREATE INDEX "CatalogItem_tenantId_companyId_status_idx" ON "CatalogItem"("tenantId", "companyId", "status");

ALTER TABLE "CatalogItem"
ADD CONSTRAINT "CatalogItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
