DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "borrow_positions"
    GROUP BY "pool_id", "borrower_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add borrow_positions_pool_id_borrower_id_unique: duplicate (pool_id, borrower_id) rows exist. Reconcile them before rerunning this migration.';
  END IF;
END $$;--> statement-breakpoint
DROP INDEX "borrow_positions_pool_id_borrower_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "borrow_positions_pool_id_borrower_id_unique" ON "borrow_positions" USING btree ("pool_id","borrower_id");--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "contract_pool_id" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "lending_pools_contract_pool_id_unique" ON "lending_pools" USING btree ("contract_pool_id");--> statement-breakpoint
ALTER TABLE "lending_pools" ADD CONSTRAINT "lending_pools_contract_pool_id_not_null" CHECK ("lending_pools"."contract_pool_id" IS NOT NULL) NOT VALID;
