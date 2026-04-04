ALTER TABLE "foundary_applications"
  ADD COLUMN "ticket_closed" boolean DEFAULT false NOT NULL,
  ADD COLUMN "ticket_closed_at" timestamp,
  ADD COLUMN "ticket_closed_by_user_id" integer REFERENCES "users"("id");
