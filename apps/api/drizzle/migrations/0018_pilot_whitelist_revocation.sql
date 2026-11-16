ALTER TYPE "public"."pilot_whitelist_status" ADD VALUE IF NOT EXISTS 'revoked';--> statement-breakpoint
ALTER TABLE "pilot_whitelist_requests" ADD COLUMN IF NOT EXISTS "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "pilot_whitelist_requests" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pilot_whitelist_requests" DROP CONSTRAINT IF EXISTS "pilot_whitelist_requests_wallet_address_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pilot_whitelist_requests_active_wallet_unique" ON "pilot_whitelist_requests" USING btree ("wallet_address") WHERE "status" IN ('pending', 'approved');
