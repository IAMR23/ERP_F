DO $$
BEGIN
  CREATE TYPE "TipoPersona" AS ENUM ('NATURAL', 'JURIDICA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TipoIdentificacion" AS ENUM ('CEDULA', 'RUC', 'PASAPORTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PersonaRol" AS ENUM ('CLIENTE', 'PROVEEDOR', 'EMPLEADO', 'VENDEDOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Person"
  ADD COLUMN IF NOT EXISTS "tipoPersona" "TipoPersona" NOT NULL DEFAULT 'NATURAL',
  ADD COLUMN IF NOT EXISTS "tipoIdentificacion" "TipoIdentificacion",
  ADD COLUMN IF NOT EXISTS "identificacion" TEXT,
  ADD COLUMN IF NOT EXISTS "nombre" TEXT,
  ADD COLUMN IF NOT EXISTS "telefono" TEXT,
  ADD COLUMN IF NOT EXISTS "direccion" TEXT,
  ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "Person"
SET
  "tipoPersona" = CASE
    WHEN "identificationType"::TEXT = 'RUC' THEN 'JURIDICA'::"TipoPersona"
    ELSE 'NATURAL'::"TipoPersona"
  END,
  "tipoIdentificacion" = CASE
    WHEN "identificationType"::TEXT = 'RUC' THEN 'RUC'::"TipoIdentificacion"
    WHEN "identificationType"::TEXT = 'CEDULA' THEN 'CEDULA'::"TipoIdentificacion"
    ELSE 'PASAPORTE'::"TipoIdentificacion"
  END,
  "identificacion" = "identificationNumber",
  "nombre" = "name",
  "telefono" = "phone",
  "activo" = ("status" = 'ACTIVE'::"EntityStatus")
WHERE "identificacion" IS NULL;

CREATE TABLE IF NOT EXISTS "PersonRole" (
  "personId" UUID NOT NULL,
  "role" "PersonaRol" NOT NULL,
  CONSTRAINT "PersonRole_pkey" PRIMARY KEY ("personId", "role")
);

INSERT INTO "PersonRole" ("personId", "role")
SELECT
  "id",
  CASE
    WHEN "category"::TEXT = 'SUPPLIER' THEN 'PROVEEDOR'::"PersonaRol"
    WHEN "category"::TEXT = 'EMPLOYEE' THEN 'EMPLEADO'::"PersonaRol"
    ELSE 'CLIENTE'::"PersonaRol"
  END
FROM "Person"
ON CONFLICT DO NOTHING;

INSERT INTO "Person" (
  "tenantId",
  "companyId",
  "category",
  "customerType",
  "identificationType",
  "identificationNumber",
  "name",
  "tipoPersona",
  "tipoIdentificacion",
  "identificacion",
  "nombre",
  "telefono",
  "phone",
  "email",
  "direccion",
  "status",
  "activo",
  "createdBy",
  "createdAt",
  "updatedAt"
)
SELECT
  supplier."tenantId",
  supplier."companyId",
  'SUPPLIER'::"PersonCategory",
  'WHOLESALE'::"CustomerType",
  CASE
    WHEN supplier."identificationType"::TEXT = 'RUC' THEN 'RUC'::"PersonIdentificationType"
    WHEN supplier."identificationType"::TEXT = 'CEDULA' THEN 'CEDULA'::"PersonIdentificationType"
    WHEN supplier."identificationType"::TEXT = 'PASSPORT' THEN 'PASSPORT'::"PersonIdentificationType"
    ELSE 'OTHER'::"PersonIdentificationType"
  END,
  supplier."fiscalId",
  supplier."legalName",
  CASE
    WHEN supplier."identificationType"::TEXT = 'RUC' THEN 'JURIDICA'::"TipoPersona"
    ELSE 'NATURAL'::"TipoPersona"
  END,
  CASE
    WHEN supplier."identificationType"::TEXT = 'RUC' THEN 'RUC'::"TipoIdentificacion"
    WHEN supplier."identificationType"::TEXT = 'CEDULA' THEN 'CEDULA'::"TipoIdentificacion"
    ELSE 'PASAPORTE'::"TipoIdentificacion"
  END,
  supplier."fiscalId",
  supplier."legalName",
  supplier."phone",
  supplier."phone",
  supplier."email",
  supplier."address",
  supplier."status",
  (supplier."status" = 'ACTIVE'::"EntityStatus"),
  supplier."createdBy",
  supplier."createdAt",
  supplier."updatedAt"
FROM "Supplier" AS supplier
WHERE NOT EXISTS (
  SELECT 1
  FROM "Person" AS person
  WHERE person."tenantId" = supplier."tenantId"
    AND person."identificacion" = supplier."fiscalId"
);

INSERT INTO "PersonRole" ("personId", "role")
SELECT person."id", 'PROVEEDOR'::"PersonaRol"
FROM "Supplier" AS supplier
JOIN "Person" AS person
  ON person."tenantId" = supplier."tenantId"
 AND person."identificacion" = supplier."fiscalId"
ON CONFLICT DO NOTHING;

ALTER TABLE "StockEntry" DROP CONSTRAINT IF EXISTS "StockEntry_supplierId_fkey";

UPDATE "StockEntry" AS entry
SET "supplierId" = person."id"
FROM "Supplier" AS supplier
JOIN "Person" AS person
  ON person."tenantId" = supplier."tenantId"
 AND person."identificacion" = supplier."fiscalId"
WHERE entry."supplierId" = supplier."id";

ALTER TABLE "Person" ALTER COLUMN "tipoIdentificacion" SET NOT NULL;
ALTER TABLE "Person" ALTER COLUMN "identificacion" SET NOT NULL;
ALTER TABLE "Person" ALTER COLUMN "nombre" SET NOT NULL;

DROP INDEX IF EXISTS "Person_companyId_identificationNumber_key";
DROP INDEX IF EXISTS "Person_tenantId_companyId_category_status_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Person_tenantId_identificacion_key" ON "Person"("tenantId", "identificacion");
CREATE INDEX IF NOT EXISTS "Person_tenantId_companyId_activo_idx" ON "Person"("tenantId", "companyId", "activo");
CREATE INDEX IF NOT EXISTS "PersonRole_role_idx" ON "PersonRole"("role");

ALTER TABLE "PersonRole" DROP CONSTRAINT IF EXISTS "PersonRole_personId_fkey";
ALTER TABLE "PersonRole"
  ADD CONSTRAINT "PersonRole_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockEntry"
  ADD CONSTRAINT "StockEntry_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Person"
  DROP COLUMN IF EXISTS "category",
  DROP COLUMN IF EXISTS "customerType",
  DROP COLUMN IF EXISTS "identificationType",
  DROP COLUMN IF EXISTS "identificationNumber",
  DROP COLUMN IF EXISTS "name",
  DROP COLUMN IF EXISTS "nombreComercial",
  DROP COLUMN IF EXISTS "phone",
  DROP COLUMN IF EXISTS "status";

DROP TABLE IF EXISTS "Supplier";
DROP TYPE IF EXISTS "SupplierIdentificationType";
DROP TYPE IF EXISTS "PersonCategory";
DROP TYPE IF EXISTS "PersonIdentificationType";
