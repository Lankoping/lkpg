CREATE TABLE "organization_invitations" (
  "id" serial PRIMARY KEY NOT NULL,
  "token" text NOT NULL,
  "email" text NOT NULL,
  "organization_name" text NOT NULL,
  "invited_by" integer,
  "accepted_by" integer,
  "accepted_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "organization_invitations_token_unique" UNIQUE("token")
);

ALTER TABLE "organization_invitations"
ADD CONSTRAINT "organization_invitations_invited_by_users_id_fk"
FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;

ALTER TABLE "organization_invitations"
ADD CONSTRAINT "organization_invitations_accepted_by_users_id_fk"
FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;