CREATE TABLE "valuations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"property_id" varchar(255) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"price" numeric(20, 2) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
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
CREATE INDEX "valuations_property_id_timestamp_idx" ON "valuations" ("property_id","timestamp");
