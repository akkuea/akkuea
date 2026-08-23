CREATE TYPE "public"."pilot_whitelist_id_type" AS ENUM('passport', 'national_id', 'drivers_license');--> statement-breakpoint
CREATE TYPE "public"."pilot_whitelist_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
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
