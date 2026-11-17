ALTER TABLE "pilot_whitelist_requests" DROP CONSTRAINT IF EXISTS "pilot_whitelist_requests_wallet_address_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pilot_whitelist_requests_active_unique" ON "pilot_whitelist_requests" USING btree ("wallet_address") WHERE "status" IN ('pending', 'approved');
