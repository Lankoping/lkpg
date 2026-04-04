CREATE TABLE "login_two_factor_codes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "challenge_id" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "login_two_factor_codes_challenge_id_unique" UNIQUE("challenge_id")
);

ALTER TABLE "login_two_factor_codes"
ADD CONSTRAINT "login_two_factor_codes_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;