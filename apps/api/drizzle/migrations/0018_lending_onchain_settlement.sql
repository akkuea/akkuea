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
  IF EXISTS (
    SELECT 1
    FROM "deposit_positions"
    GROUP BY "pool_id", "depositor_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add deposit_positions_pool_id_depositor_id_unique: duplicate (pool_id, depositor_id) rows exist. Reconcile them before rerunning this migration.';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "contract_pool_id" varchar(128);--> statement-breakpoint
CREATE UNIQUE INDEX "borrow_positions_pool_id_borrower_id_unique" ON "borrow_positions" USING btree ("pool_id","borrower_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_positions_pool_id_depositor_id_unique" ON "deposit_positions" USING btree ("pool_id","depositor_id");--> statement-breakpoint
ALTER TABLE "lending_pools" ADD CONSTRAINT "lending_pools_contract_pool_id_unique" UNIQUE("contract_pool_id");
