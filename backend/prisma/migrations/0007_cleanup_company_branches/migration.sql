DO $$
DECLARE
  kept_tenant_id UUID;
  kept_company_id UUID;
  kept_branch_one_id UUID;
  kept_branch_two_id UUID;
  first_user_id UUID;
  second_branch_code TEXT;
BEGIN
  SELECT "id"
  INTO kept_tenant_id
  FROM "Tenant"
  ORDER BY
    CASE WHEN "id" = '00000000-0000-0000-0000-000000000001'::uuid THEN 0 ELSE 1 END,
    "createdAt" ASC,
    "id" ASC
  LIMIT 1;

  IF kept_tenant_id IS NULL THEN
    INSERT INTO "Tenant" ("id", "name")
    VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Tenant Demo')
    RETURNING "id" INTO kept_tenant_id;
  END IF;

  SELECT "id"
  INTO first_user_id
  FROM "User"
  WHERE "tenantId" = kept_tenant_id
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1;

  SELECT "id"
  INTO kept_company_id
  FROM "Company"
  WHERE "tenantId" = kept_tenant_id
  ORDER BY
    CASE WHEN "ruc" = '1790012345001' THEN 0 ELSE 1 END,
    CASE WHEN "status" = 'ACTIVE'::"EntityStatus" THEN 0 ELSE 1 END,
    "createdAt" ASC,
    "id" ASC
  LIMIT 1;

  IF kept_company_id IS NULL THEN
    INSERT INTO "Company" (
      "tenantId",
      "legalName",
      "tradeName",
      "ruc",
      "mainAddress",
      "email",
      "phone",
      "createdBy"
    )
    VALUES (
      kept_tenant_id,
      'Mascota Urbana Demo S.A.',
      'Mascota Urbana Demo',
      '1790012345001',
      'Av. Demo y Principal',
      'demo@mascotaurbana.local',
      '0999999999',
      first_user_id
    )
    RETURNING "id" INTO kept_company_id;
  END IF;

  SELECT "id"
  INTO kept_branch_one_id
  FROM "Branch"
  WHERE "companyId" = kept_company_id
  ORDER BY
    CASE WHEN "code" = '001' THEN 0 ELSE 1 END,
    CASE WHEN "status" = 'ACTIVE'::"EntityStatus" THEN 0 ELSE 1 END,
    "createdAt" ASC,
    "id" ASC
  LIMIT 1;

  IF kept_branch_one_id IS NULL THEN
    INSERT INTO "Branch" (
      "tenantId",
      "companyId",
      "code",
      "name",
      "address",
      "phone",
      "email",
      "managerName",
      "sriEstablishmentCode"
    )
    VALUES (
      kept_tenant_id,
      kept_company_id,
      '001',
      'Matriz',
      'Av. Demo y Principal',
      '0999999999',
      'matriz@mascotaurbana.local',
      'Administrador Demo',
      '001'
    )
    RETURNING "id" INTO kept_branch_one_id;
  END IF;

  SELECT "id"
  INTO kept_branch_two_id
  FROM "Branch"
  WHERE "companyId" = kept_company_id
    AND "id" <> kept_branch_one_id
  ORDER BY
    CASE WHEN "code" = '002' THEN 0 ELSE 1 END,
    CASE WHEN "status" = 'ACTIVE'::"EntityStatus" THEN 0 ELSE 1 END,
    "createdAt" ASC,
    "id" ASC
  LIMIT 1;

  IF kept_branch_two_id IS NULL THEN
    second_branch_code := CASE
      WHEN EXISTS (
        SELECT 1
        FROM "Branch"
        WHERE "companyId" = kept_company_id
          AND "code" = '002'
      )
      THEN '001'
      ELSE '002'
    END;

    INSERT INTO "Branch" (
      "tenantId",
      "companyId",
      "code",
      "name",
      "address",
      "phone",
      "email",
      "managerName",
      "sriEstablishmentCode"
    )
    VALUES (
      kept_tenant_id,
      kept_company_id,
      second_branch_code,
      'Sucursal 2',
      'Direccion sucursal 2',
      '0999999998',
      'sucursal2@mascotaurbana.local',
      'Administrador Demo',
      second_branch_code
    )
    RETURNING "id" INTO kept_branch_two_id;
  END IF;

  TRUNCATE TABLE
    "AuditLog",
    "CatalogItemImage",
    "SalePayment",
    "SaleLine",
    "Sale",
    "SaleDocumentSequence",
    "StockCountLine",
    "StockCount",
    "StockAdjustmentLine",
    "StockAdjustment",
    "StockTransferLine",
    "StockTransfer",
    "StockEntryLine",
    "StockEntry",
    "InventoryMovement",
    "StockBalance",
    "CatalogItem",
    "Subcategory",
    "Category",
    "Supplier",
    "Person",
    "Warehouse",
    "TaxRate",
    "PaymentMethod"
  RESTART IDENTITY CASCADE;

  DELETE FROM "UserBranchScope"
  WHERE "branchId" NOT IN (kept_branch_one_id, kept_branch_two_id);

  DELETE FROM "UserCompanyScope"
  WHERE "companyId" <> kept_company_id;

  DELETE FROM "Branch"
  WHERE "id" NOT IN (kept_branch_one_id, kept_branch_two_id);

  DELETE FROM "Company"
  WHERE "id" <> kept_company_id;

  INSERT INTO "UserCompanyScope" ("userId", "companyId")
  SELECT "id", kept_company_id
  FROM "User"
  WHERE "tenantId" = kept_tenant_id
  ON CONFLICT DO NOTHING;

  INSERT INTO "UserBranchScope" ("userId", "branchId")
  SELECT users."id", branches."id"
  FROM "User" AS users
  CROSS JOIN (
    VALUES (kept_branch_one_id), (kept_branch_two_id)
  ) AS branches("id")
  WHERE users."tenantId" = kept_tenant_id
  ON CONFLICT DO NOTHING;
END $$;
