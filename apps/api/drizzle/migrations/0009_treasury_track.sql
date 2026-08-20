CREATE TABLE IF NOT EXISTS "treasury_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue" varchar(64) NOT NULL,
	"operation" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"vault_contract_id" varchar(56) NOT NULL,
	"source_account" varchar(56) NOT NULL,
	"asset_code" varchar(12) NOT NULL,
	"amount" numeric(30, 7),
	"shares" numeric(30, 7),
	"tx_hash" varchar(64),
	"error_name" varchar(64),
	"error_code" varchar(16),
	"requested_by" varchar(128) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "treasury_position_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue" varchar(64) NOT NULL,
	"vault_contract_id" varchar(56) NOT NULL,
	"asset_code" varchar(12) NOT NULL,
	"shares" numeric(30, 7) NOT NULL,
	"position_value" numeric(30, 7) NOT NULL,
	"vault_total_managed" numeric(30, 7) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_transactions_venue_created_at_idx" ON "treasury_transactions" ("venue", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_transactions_status_idx" ON "treasury_transactions" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_snapshots_venue_captured_at_idx" ON "treasury_position_snapshots" ("venue", "captured_at");
