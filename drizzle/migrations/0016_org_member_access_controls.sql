ALTER TABLE "organization_members"
ADD COLUMN IF NOT EXISTS "can_manage_members" boolean DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS "can_request_funds" boolean DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS "can_manage_tickets" boolean DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS "can_access_storage" boolean DEFAULT true NOT NULL;
