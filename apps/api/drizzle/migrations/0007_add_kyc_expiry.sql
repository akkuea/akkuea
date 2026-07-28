-- Add KYC expiry timestamp to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_expires_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_kyc_expires_at_idx" ON "users" ("kyc_expires_at") WHERE "kyc_status" = 'approved';
--> statement-breakpoint
-- Add KYC expiry notification event types to the enum
ALTER TYPE "public"."notification_event_type" ADD VALUE IF NOT EXISTS 'KYC_EXPIRY_REMINDER';
--> statement-breakpoint
ALTER TYPE "public"."notification_event_type" ADD VALUE IF NOT EXISTS 'KYC_EXPIRED';
