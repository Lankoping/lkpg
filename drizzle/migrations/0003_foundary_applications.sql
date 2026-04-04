CREATE TABLE "foundary_applications" (
  "id" serial PRIMARY KEY NOT NULL,
  "applicant_name" text NOT NULL,
  "email" text NOT NULL,
  "age" integer NOT NULL,
  "city_country" text NOT NULL,
  "organization_name" text NOT NULL,
  "organization_status" text NOT NULL,
  "has_hcb_account" boolean DEFAULT false NOT NULL,
  "hcb_username" text,
  "preferred_payment_method" text NOT NULL,
  "event_name" text NOT NULL,
  "planned_months" text NOT NULL,
  "expected_attendees" integer NOT NULL,
  "funding_request_amount" integer NOT NULL,
  "brief_event_description" text NOT NULL,
  "budget_justification" text NOT NULL,
  "terms_accepted" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "review_notes" text,
  "reviewed_by" integer,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "foundary_applications"
ADD CONSTRAINT "foundary_applications_reviewed_by_users_id_fk"
FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;