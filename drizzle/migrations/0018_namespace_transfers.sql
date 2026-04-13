CREATE TABLE IF NOT EXISTS "organization_namespace_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_name" text NOT NULL,
	"new_organization_name" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"current_step" text DEFAULT '' NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"completed_steps" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_namespace_transfers_organization_name_idx" ON "organization_namespace_transfers" USING btree ("organization_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_namespace_transfers_new_organization_name_idx" ON "organization_namespace_transfers" USING btree ("new_organization_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_namespace_transfers_started_at_idx" ON "organization_namespace_transfers" USING btree ("started_at");