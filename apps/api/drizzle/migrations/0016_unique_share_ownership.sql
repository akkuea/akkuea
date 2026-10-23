DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "share_ownerships"
    GROUP BY "property_id", "owner_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add share_ownerships_property_owner_unique: duplicate (property_id, owner_id) rows exist. Reconcile them before rerunning this migration.';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "share_ownerships_property_owner_unique"
  ON "share_ownerships" USING btree ("property_id", "owner_id");
