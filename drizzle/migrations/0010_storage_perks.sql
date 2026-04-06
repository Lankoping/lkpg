CREATE TABLE "storage_perk_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_name" text NOT NULL,
  "requested_by_user_id" integer NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "review_notes" text,
  "reviewed_by" integer,
  "reviewed_at" timestamp,
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "storage_perk_requests_organization_name_unique" UNIQUE("organization_name")
);

CREATE TABLE "storage_upload_reservations" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_name" text NOT NULL,
  "requested_by_user_id" integer NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text,
  "object_key" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "storage_upload_reservations_object_key_unique" UNIQUE("object_key")
);

CREATE TABLE "storage_files" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_name" text NOT NULL,
  "uploaded_by_user_id" integer NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text,
  "object_key" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "storage_files_object_key_unique" UNIQUE("object_key")
);

ALTER TABLE "storage_perk_requests" ADD CONSTRAINT "storage_perk_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storage_perk_requests" ADD CONSTRAINT "storage_perk_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storage_upload_reservations" ADD CONSTRAINT "storage_upload_reservations_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "storage_files" ADD CONSTRAINT "storage_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;