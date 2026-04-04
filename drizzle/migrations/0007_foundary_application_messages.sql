CREATE TABLE "foundary_application_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "application_id" integer NOT NULL,
  "sender_user_id" integer NOT NULL,
  "sender_role" text NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "foundary_application_messages"
ADD CONSTRAINT "foundary_application_messages_application_id_foundary_applications_id_fk"
FOREIGN KEY ("application_id") REFERENCES "public"."foundary_applications"("id")
ON DELETE no action ON UPDATE no action;

ALTER TABLE "foundary_application_messages"
ADD CONSTRAINT "foundary_application_messages_sender_user_id_users_id_fk"
FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;