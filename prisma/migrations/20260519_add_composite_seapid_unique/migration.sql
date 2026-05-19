-- Drop global unique on seapId — was blocking second org from receiving a tender
-- that matched multiple organizations (constraint error swallowed silently in scanner)
DROP INDEX IF EXISTS "Tender_seapId_key";

-- Add per-org composite unique — same SEAP tender can be stored once per organization
CREATE UNIQUE INDEX IF NOT EXISTS "Tender_seapId_organizationId_key" ON "Tender"("seapId", "organizationId");
