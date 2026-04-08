ALTER TABLE "foundary_applications"
  ADD COLUMN IF NOT EXISTS "ticket_priority" text DEFAULT 'normal' NOT NULL,
  ADD COLUMN IF NOT EXISTS "ticket_labels" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "assigned_to_user_id" integer;

DO $$ BEGIN
  ALTER TABLE "foundary_applications"
  ADD CONSTRAINT "foundary_applications_assigned_to_user_id_users_id_fk"
  FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "foundary_applications_assigned_to_user_id_idx"
  ON "foundary_applications" ("assigned_to_user_id");

CREATE INDEX IF NOT EXISTS "foundary_applications_ticket_priority_idx"
  ON "foundary_applications" ("ticket_priority");

ALTER TABLE "hosted_support_tickets"
  ADD COLUMN IF NOT EXISTS "ticket_priority" text DEFAULT 'normal' NOT NULL,
  ADD COLUMN IF NOT EXISTS "ticket_labels" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "assigned_to_user_id" integer;

DO $$ BEGIN
  ALTER TABLE "hosted_support_tickets"
  ADD CONSTRAINT "hosted_support_tickets_assigned_to_user_id_users_id_fk"
  FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "hosted_support_tickets_assigned_to_user_id_idx"
  ON "hosted_support_tickets" ("assigned_to_user_id");

CREATE INDEX IF NOT EXISTS "hosted_support_tickets_ticket_priority_idx"
  ON "hosted_support_tickets" ("ticket_priority");
