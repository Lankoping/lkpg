ALTER TABLE "foundary_applications"
  ADD COLUMN IF NOT EXISTS "is_application_ticket" boolean DEFAULT false NOT NULL;
