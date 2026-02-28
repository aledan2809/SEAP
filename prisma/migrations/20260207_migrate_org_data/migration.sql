-- Migration: Convert User.organizationId to UserOrganization many-to-many
-- This migrates existing user-organization relationships to the new junction table

-- Step 1: Create UserOrganization table if not exists
CREATE TABLE IF NOT EXISTS "UserOrganization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("id")
);

-- Step 2: Add unique constraint
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_organizationId_key" UNIQUE ("userId", "organizationId");

-- Step 3: Add foreign keys
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Add indexes
CREATE INDEX IF NOT EXISTS "UserOrganization_userId_idx" ON "UserOrganization"("userId");
CREATE INDEX IF NOT EXISTS "UserOrganization_organizationId_idx" ON "UserOrganization"("organizationId");

-- Step 5: Migrate existing data from User.organizationId to UserOrganization
INSERT INTO "UserOrganization" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "organizationId",
    COALESCE("role", 'MEMBER'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "organizationId" IS NOT NULL
ON CONFLICT ("userId", "organizationId") DO NOTHING;

-- Step 6: Add activeOrganizationId column to User if not exists
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeOrganizationId" TEXT;

-- Step 7: Set activeOrganizationId from existing organizationId
UPDATE "User" SET "activeOrganizationId" = "organizationId" WHERE "organizationId" IS NOT NULL AND "activeOrganizationId" IS NULL;

-- Step 8: Add foreign key for activeOrganizationId
ALTER TABLE "User" ADD CONSTRAINT "User_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 9: Add index for activeOrganizationId
CREATE INDEX IF NOT EXISTS "User_activeOrganizationId_idx" ON "User"("activeOrganizationId");
