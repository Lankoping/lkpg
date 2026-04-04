ALTER TABLE "foundary_applications"
ADD COLUMN IF NOT EXISTS "requested_events" integer DEFAULT 1 NOT NULL;

CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "organization_name" text NOT NULL,
  "added_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "organization_members"
ADD CONSTRAINT "organization_members_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;

ALTER TABLE "organization_members"
ADD CONSTRAINT "organization_members_added_by_users_id_fk"
FOREIGN KEY ("added_by") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_user_org_unique"
ON "organization_members" ("user_id", "organization_name");

INSERT INTO "organization_members" ("user_id", "organization_name", "added_by")
SELECT u.id, fa.organization_name, u.id
FROM "users" u
JOIN "foundary_applications" fa
  ON lower(u.email) = lower(fa.email)
ON CONFLICT DO NOTHING;