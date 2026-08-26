ALTER TYPE "public"."notification_event_type" ADD VALUE 'PILOT_REPORTING_ESCALATION';--> statement-breakpoint
CREATE TABLE "pilot_escalation_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar(56) NOT NULL,
	"last_missed_cycle_id" text NOT NULL,
	"consecutive_missed" integer NOT NULL,
	"first_notified_at" timestamp with time zone NOT NULL,
	"last_notified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pilot_escalation_state_contract_id_unique" UNIQUE("contract_id")
);
