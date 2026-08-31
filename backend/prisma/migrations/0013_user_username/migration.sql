ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

UPDATE "User"
SET "username" = lower("email")
WHERE "username" IS NULL OR trim("username") = '';

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_username_key" ON "User"("tenantId", "username");
