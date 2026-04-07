CREATE TABLE IF NOT EXISTS "hosted_support_ticket_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "ticket_id" integer NOT NULL,
  "sender_user_id" integer NOT NULL,
  "sender_role" text NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "hosted_support_ticket_messages"
  ADD CONSTRAINT "hosted_support_ticket_messages_ticket_id_hosted_support_tickets_id_fk"
  FOREIGN KEY ("ticket_id") REFERENCES "public"."hosted_support_tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "hosted_support_ticket_messages"
  ADD CONSTRAINT "hosted_support_ticket_messages_sender_user_id_users_id_fk"
  FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "hosted_support_ticket_messages_ticket_id_idx"
  ON "hosted_support_ticket_messages" ("ticket_id");
