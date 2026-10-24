DROP INDEX "transactions_hash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_hash_idx" ON "transactions" USING btree ("hash");
