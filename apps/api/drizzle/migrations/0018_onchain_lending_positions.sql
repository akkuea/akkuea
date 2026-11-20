DROP INDEX "borrow_positions_pool_id_borrower_id_idx";--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "contract_pool_id" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "borrow_positions_pool_id_borrower_id_unique" ON "borrow_positions" USING btree ("pool_id","borrower_id");