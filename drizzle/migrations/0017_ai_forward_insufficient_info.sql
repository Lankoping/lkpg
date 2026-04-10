-- Add AI confidence and auto-forward fields to hosted support tickets
ALTER TABLE "hosted_support_tickets"
  ADD COLUMN IF NOT EXISTS "ai_has_sufficient_info" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "should_forward_to_staff" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "ai_summary" text;

CREATE INDEX IF NOT EXISTS "hosted_support_tickets_ai_has_sufficient_info_idx"
  ON "hosted_support_tickets" ("ai_has_sufficient_info");

CREATE INDEX IF NOT EXISTS "hosted_support_tickets_should_forward_to_staff_idx"
  ON "hosted_support_tickets" ("should_forward_to_staff");
