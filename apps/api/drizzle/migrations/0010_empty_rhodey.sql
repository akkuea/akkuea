CREATE TYPE "public"."property_review_status" AS ENUM('pending_review', 'approved', 'rejected', 'changes_requested', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'EMAIL', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');--> statement-breakpoint
CREATE TYPE "public"."notification_event_type" AS ENUM('VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'VALUATION_UPDATED', 'REPAYMENT_REMINDER', 'REPAYMENT_OVERDUE', 'REPAYMENT_PROCESSED', 'RISK_WARNING', 'LIQUIDATION_RISK', 'LIQUIDATION_EXECUTED', 'SYSTEM_ALERT', 'INVESTMENT_OPPORTUNITY', 'PORTFOLIO_UPDATE', 'KYC_EXPIRY_REMINDER', 'KYC_EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."pilot_whitelist_id_type" AS ENUM('passport', 'national_id', 'drivers_license');--> statement-breakpoint
CREATE TYPE "public"."pilot_whitelist_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" "notification_event_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"related_entity_type" varchar(50),
	"related_entity_id" varchar(255),
	"channel" "notification_channel" NOT NULL,
	"delivery_status" "notification_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"recipient" varchar(255),
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failure_reason" text,
	"retry_count" varchar(3) DEFAULT '0' NOT NULL,
	"max_retries" varchar(3) DEFAULT '3' NOT NULL,
	"next_retry_at" timestamp with time zone,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"property_id" varchar(255) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"price" numeric(20, 2) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"confidence" numeric(7, 4) NOT NULL,
	"methodology" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"rejection_reason" text,
	"provenance" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_dlq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"channel" text NOT NULL,
	"recipient" text,
	"related_entity_type" text,
	"related_entity_id" text,
	"metadata" text,
	"last_failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"requeued_at" timestamp with time zone,
	"requeued_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" varchar(56) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_whitelist_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(56) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"id_type" "pilot_whitelist_id_type" NOT NULL,
	"id_reference" varchar(255) NOT NULL,
	"status" "pilot_whitelist_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "pilot_whitelist_requests_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "treasury_position_snapshots" (
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
CREATE TABLE "treasury_transactions" (
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
ALTER TABLE "users" ADD COLUMN "kyc_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "soroban_property_id" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "review_status" "property_review_status" DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_review_note" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_reviewer_wallet" varchar(56);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "valuations_property_id_timestamp_idx" ON "valuations" USING btree ("property_id","timestamp");--> statement-breakpoint
CREATE INDEX "treasury_snapshots_venue_captured_at_idx" ON "treasury_position_snapshots" USING btree ("venue","captured_at");--> statement-breakpoint
CREATE INDEX "treasury_transactions_venue_created_at_idx" ON "treasury_transactions" USING btree ("venue","created_at");--> statement-breakpoint
CREATE INDEX "treasury_transactions_status_idx" ON "treasury_transactions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_soroban_property_id_unique" UNIQUE("soroban_property_id");