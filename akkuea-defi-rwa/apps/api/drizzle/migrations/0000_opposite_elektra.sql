CREATE TYPE "public"."kyc_document_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."kyc_document_type" AS ENUM('passport', 'national_id', 'drivers_license', 'proof_of_address', 'bank_statement', 'tax_document');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('not_started', 'pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."kyc_tier" AS ENUM('none', 'basic', 'verified', 'accredited');--> statement-breakpoint
CREATE TYPE "public"."property_document_type" AS ENUM('deed', 'appraisal', 'inspection', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('residential', 'commercial', 'industrial', 'land', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'withdraw', 'borrow', 'repay', 'liquidation', 'buy_shares', 'sell_shares', 'dividend');--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "kyc_document_type" NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"status" "kyc_document_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(56) NOT NULL,
	"email" varchar(255),
	"display_name" varchar(50),
	"kyc_status" "kyc_status" DEFAULT 'not_started' NOT NULL,
	"kyc_tier" "kyc_tier" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"property_type" "property_type" NOT NULL,
	"location" jsonb NOT NULL,
	"total_value" numeric(20, 2) NOT NULL,
	"token_address" varchar(56),
	"total_shares" integer NOT NULL,
	"available_shares" integer NOT NULL,
	"price_per_share" numeric(20, 2) NOT NULL,
	"images" jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"listed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"type" "property_document_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_ownerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"shares" integer NOT NULL,
	"purchase_price" numeric(20, 2) NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_dividend_claimed" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "borrow_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"principal" numeric(20, 7) NOT NULL,
	"accrued_interest" numeric(20, 7) DEFAULT '0' NOT NULL,
	"collateral_amount" numeric(20, 7) NOT NULL,
	"collateral_asset" varchar(56) NOT NULL,
	"health_factor" numeric(10, 4) NOT NULL,
	"borrowed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accrual_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"depositor_id" uuid NOT NULL,
	"amount" numeric(20, 7) NOT NULL,
	"shares" numeric(20, 7) NOT NULL,
	"deposited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accrual_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accrued_interest" numeric(20, 7) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lending_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"asset" varchar(20) NOT NULL,
	"asset_address" varchar(56) NOT NULL,
	"total_deposits" numeric(20, 7) DEFAULT '0' NOT NULL,
	"total_borrows" numeric(20, 7) DEFAULT '0' NOT NULL,
	"available_liquidity" numeric(20, 7) DEFAULT '0' NOT NULL,
	"utilization_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"supply_apy" numeric(5, 2) DEFAULT '0' NOT NULL,
	"borrow_apy" numeric(5, 2) DEFAULT '0' NOT NULL,
	"collateral_factor" numeric(5, 2) NOT NULL,
	"liquidation_threshold" numeric(5, 2) NOT NULL,
	"liquidation_penalty" numeric(5, 2) NOT NULL,
	"reserve_factor" integer DEFAULT 1000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "transaction_type" NOT NULL,
	"hash" varchar(64),
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid,
	"amount" numeric(20, 7) NOT NULL,
	"asset" varchar(56) NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_ownerships" ADD CONSTRAINT "share_ownerships_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_ownerships" ADD CONSTRAINT "share_ownerships_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrow_positions" ADD CONSTRAINT "borrow_positions_pool_id_lending_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."lending_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrow_positions" ADD CONSTRAINT "borrow_positions_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_positions" ADD CONSTRAINT "deposit_positions_pool_id_lending_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."lending_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_positions" ADD CONSTRAINT "deposit_positions_depositor_id_users_id_fk" FOREIGN KEY ("depositor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;