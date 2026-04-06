ALTER TABLE "storage_perk_requests"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp,
  ADD COLUMN IF NOT EXISTS "terms_accepted_by_user_id" integer REFERENCES "users"("id");