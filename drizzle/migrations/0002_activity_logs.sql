CREATE TABLE "activity_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_user_id" integer NOT NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" integer,
  "details" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "activity_logs"
ADD CONSTRAINT "activity_logs_actor_user_id_users_id_fk"
FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;
