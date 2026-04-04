ALTER TABLE "foundary_applications"
  ADD COLUMN "created_by_user_id" integer REFERENCES "users"("id"),
  ADD COLUMN "is_confidential" boolean DEFAULT true NOT NULL;

UPDATE "foundary_applications" fa
SET "created_by_user_id" = u."id"
FROM "users" u
WHERE fa."created_by_user_id" IS NULL
  AND lower(fa."email") = lower(u."email");
