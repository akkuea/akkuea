CREATE TYPE "public"."property_review_status" AS ENUM('pending_review', 'approved', 'rejected', 'changes_requested', 'on_hold');--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "review_status" "property_review_status" DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_review_note" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_reviewer_wallet" varchar(56);--> statement-breakpoint
UPDATE "properties" SET "review_status" = 'approved' WHERE "verified" = true;--> statement-breakpoint
UPDATE "properties" SET "review_status" = 'pending_review' WHERE "verified" = false;
