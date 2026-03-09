CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"location" text,
	"image" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_id" integer NOT NULL,
	"device_name" text NOT NULL,
	"browser_name" text NOT NULL,
	"platform" text NOT NULL,
	"page" text NOT NULL,
	"load_time" real NOT NULL,
	"dom_content_loaded" real,
	"first_paint" real,
	"success" boolean NOT NULL,
	"error" text,
	"page_title" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_date" timestamp DEFAULT now() NOT NULL,
	"total_tests" integer NOT NULL,
	"successful_tests" integer NOT NULL,
	"failed_tests" integer NOT NULL,
	"success_rate" real NOT NULL,
	"avg_load_time" real NOT NULL,
	"min_load_time" real,
	"max_load_time" real,
	"duration" real NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"results" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"type" text DEFAULT 'blog' NOT NULL,
	"published" boolean DEFAULT false,
	"author_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"participant_name" text NOT NULL,
	"participant_email" text NOT NULL,
	"ticket_type" text DEFAULT 'standard' NOT NULL,
	"price_paid" integer DEFAULT 0 NOT NULL,
	"ticket_code" text NOT NULL,
	"status" text DEFAULT 'valid' NOT NULL,
	"scanned_at" timestamp,
	"scanned_by" integer,
	"issued_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tickets_ticket_code_unique" UNIQUE("ticket_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "performance_test_results" ADD CONSTRAINT "performance_test_results_test_id_performance_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."performance_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;