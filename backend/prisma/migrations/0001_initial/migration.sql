CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CatalogType" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "AuditAction" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'COMPANY_CREATED',
  'COMPANY_UPDATED',
  'COMPANY_DISABLED',
  'BRANCH_CREATED',
  'BRANCH_UPDATED',
  'BRANCH_DISABLED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DISABLED',
  'ROLE_PERMISSIONS_ASSIGNED',
  'USER_ROLES_ASSIGNED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DISABLED',
  'SUBCATEGORY_CREATED',
  'SUBCATEGORY_UPDATED',
  'SUBCATEGORY_DISABLED',
  'ITEM_CREATED',
  'ITEM_UPDATED',
  'ITEM_DISABLED',
  'IMAGE_CREATED',
  'IMAGE_UPDATED',
  'IMAGE_DISABLED'
);

CREATE TABLE "Tenant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "plan" TEXT NOT NULL DEFAULT 'development',
  "storageQuotaBytes" BIGINT NOT NULL DEFAULT 104857600,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Company" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT NOT NULL,
  "ruc" TEXT NOT NULL,
  "mainAddress" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "logoObjectKey" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "sriEnvironment" TEXT NOT NULL DEFAULT 'TEST',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "timezone" TEXT NOT NULL DEFAULT 'America/Guayaquil',
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Branch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "managerName" TEXT NOT NULL,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "sriEstablishmentCode" TEXT NOT NULL DEFAULT '001',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "refreshTokenHash" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Role" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
  "userId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

CREATE TABLE "RolePermission" (
  "roleId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE TABLE "UserCompanyScope" (
  "userId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  CONSTRAINT "UserCompanyScope_pkey" PRIMARY KEY ("userId","companyId")
);

CREATE TABLE "UserBranchScope" (
  "userId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  CONSTRAINT "UserBranchScope_pkey" PRIMARY KEY ("userId","branchId")
);

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "type" "CatalogType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subcategory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "subcategoryId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "internalCode" TEXT NOT NULL,
  "barcode" TEXT,
  "salePrice" DECIMAL(12,2) NOT NULL,
  "cost" DECIMAL(12,2) NOT NULL,
  "taxRateId" TEXT,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogItemImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "objectKey" TEXT NOT NULL,
  "thumbnailObjectKey" TEXT,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "CatalogItemImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID,
  "userId" UUID,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_tenantId_ruc_key" ON "Company"("tenantId", "ruc");
CREATE INDEX "Company_tenantId_status_idx" ON "Company"("tenantId", "status");
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");
CREATE INDEX "Branch_tenantId_companyId_idx" ON "Branch"("tenantId", "companyId");
CREATE INDEX "Branch_tenantId_status_idx" ON "Branch"("tenantId", "status");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX "User_tenantId_status_idx" ON "User"("tenantId", "status");
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");
CREATE INDEX "Role_tenantId_status_idx" ON "Role"("tenantId", "status");
CREATE UNIQUE INDEX "Permission_tenantId_code_key" ON "Permission"("tenantId", "code");
CREATE UNIQUE INDEX "Category_tenantId_type_name_key" ON "Category"("tenantId", "type", "name");
CREATE INDEX "Category_tenantId_type_status_idx" ON "Category"("tenantId", "type", "status");
CREATE UNIQUE INDEX "Subcategory_tenantId_categoryId_name_key" ON "Subcategory"("tenantId", "categoryId", "name");
CREATE INDEX "Subcategory_tenantId_categoryId_status_idx" ON "Subcategory"("tenantId", "categoryId", "status");
CREATE UNIQUE INDEX "CatalogItem_tenantId_internalCode_key" ON "CatalogItem"("tenantId", "internalCode");
CREATE INDEX "CatalogItem_tenantId_status_idx" ON "CatalogItem"("tenantId", "status");
CREATE INDEX "CatalogItem_tenantId_subcategoryId_idx" ON "CatalogItem"("tenantId", "subcategoryId");
CREATE UNIQUE INDEX "CatalogItemImage_objectKey_key" ON "CatalogItemImage"("objectKey");
CREATE INDEX "CatalogItemImage_tenantId_catalogItemId_status_idx" ON "CatalogItemImage"("tenantId", "catalogItemId", "status");
CREATE INDEX "AuditLog_tenantId_action_createdAt_idx" ON "AuditLog"("tenantId", "action", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompanyScope" ADD CONSTRAINT "UserCompanyScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompanyScope" ADD CONSTRAINT "UserCompanyScope_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranchScope" ADD CONSTRAINT "UserBranchScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranchScope" ADD CONSTRAINT "UserBranchScope_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogItemImage" ADD CONSTRAINT "CatalogItemImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogItemImage" ADD CONSTRAINT "CatalogItemImage_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogItemImage" ADD CONSTRAINT "CatalogItemImage_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
