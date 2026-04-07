CREATE TABLE IF NOT EXISTS "hosted_support_tickets" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "message" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "closed_at" timestamp,
  "closed_by_user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "hosted_support_tickets"
  ADD CONSTRAINT "hosted_support_tickets_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "hosted_support_tickets"
  ADD CONSTRAINT "hosted_support_tickets_closed_by_user_id_users_id_fk"
  FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "hosted_support_tickets_user_id_idx"
  ON "hosted_support_tickets" ("user_id");

CREATE INDEX IF NOT EXISTS "hosted_support_tickets_status_idx"
  ON "hosted_support_tickets" ("status");
