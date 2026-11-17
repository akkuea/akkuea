ALTER TYPE "public"."pilot_whitelist_status" ADD VALUE IF NOT EXISTS 'revoked';--> statement-breakpoint
ALTER TABLE "pilot_whitelist_requests" ADD COLUMN IF NOT EXISTS "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "pilot_whitelist_requests" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
