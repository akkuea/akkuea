DROP INDEX "borrow_positions_pool_id_borrower_id_idx";--> statement-breakpoint
ALTER TABLE "lending_pools" ADD COLUMN "contract_pool_id" varchar(64);--> statement-breakpoint
LOCK TABLE "borrow_positions" IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "borrow_positions"
    GROUP BY "pool_id", "borrower_id"
    HAVING COUNT(*) > 1 AND COUNT(DISTINCT "collateral_asset") > 1
  ) THEN
    RAISE EXCEPTION 'Cannot merge duplicate borrow positions with different collateral assets';
  END IF;
END
$$;--> statement-breakpoint
WITH duplicate_positions AS (
  SELECT
    "pool_id",
    "borrower_id",
    (ARRAY_AGG("id" ORDER BY "borrowed_at", "id"))[1] AS "survivor_id",
    SUM("principal") AS "principal",
    SUM("accrued_interest") AS "accrued_interest",
    SUM("collateral_amount") AS "collateral_amount",
    MIN("collateral_asset") AS "collateral_asset",
    MIN("health_factor") AS "health_factor",
    MIN("borrowed_at") AS "borrowed_at",
    MAX("last_accrual_at") AS "last_accrual_at"
  FROM "borrow_positions"
  GROUP BY "pool_id", "borrower_id"
  HAVING COUNT(*) > 1
)
UPDATE "borrow_positions" AS positions
SET
  "principal" = duplicate_positions."principal",
  "accrued_interest" = duplicate_positions."accrued_interest",
  "collateral_amount" = duplicate_positions."collateral_amount",
  "collateral_asset" = duplicate_positions."collateral_asset",
  "health_factor" = duplicate_positions."health_factor",
  "borrowed_at" = duplicate_positions."borrowed_at",
  "last_accrual_at" = duplicate_positions."last_accrual_at"
FROM duplicate_positions
WHERE positions."id" = duplicate_positions."survivor_id";--> statement-breakpoint
WITH duplicate_positions AS (
  SELECT
    "pool_id",
    "borrower_id",
    (ARRAY_AGG("id" ORDER BY "borrowed_at", "id"))[1] AS "survivor_id"
  FROM "borrow_positions"
  GROUP BY "pool_id", "borrower_id"
  HAVING COUNT(*) > 1
)
DELETE FROM "borrow_positions" AS positions
USING duplicate_positions
WHERE positions."pool_id" = duplicate_positions."pool_id"
  AND positions."borrower_id" = duplicate_positions."borrower_id"
  AND positions."id" <> duplicate_positions."survivor_id";--> statement-breakpoint
CREATE UNIQUE INDEX "borrow_positions_pool_id_borrower_id_unique" ON "borrow_positions" USING btree ("pool_id","borrower_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lending_pools_contract_pool_id_unique" ON "lending_pools" USING btree ("contract_pool_id");