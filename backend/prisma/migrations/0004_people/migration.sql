ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERSON_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERSON_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERSON_DISABLED';

CREATE TYPE "PersonCategory" AS ENUM ('CLIENT', 'SUPPLIER', 'EMPLOYEE');
CREATE TYPE "PersonIdentificationType" AS ENUM ('CEDULA', 'RUC', 'PASSPORT', 'OTHER');

CREATE TABLE "Person" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "category" "PersonCategory" NOT NULL,
  "identificationType" "PersonIdentificationType" NOT NULL,
  "identificationNumber" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Person_companyId_identificationNumber_key" ON "Person"("companyId", "identificationNumber");
CREATE INDEX "Person_tenantId_companyId_category_status_idx" ON "Person"("tenantId", "companyId", "category", "status");

ALTER TABLE "Person" ADD CONSTRAINT "Person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Person" ADD CONSTRAINT "Person_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
