CREATE TYPE "public"."notification_event_type" AS ENUM('VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'VALUATION_UPDATED', 'REPAYMENT_REMINDER', 'REPAYMENT_OVERDUE', 'REPAYMENT_PROCESSED', 'RISK_WARNING', 'LIQUIDATION_RISK', 'SYSTEM_ALERT', 'INVESTMENT_OPPORTUNITY', 'PORTFOLIO_UPDATE');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'EMAIL', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');--> statement-breakpoint
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
);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id_created_at" ON "notifications" USING btree ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_notifications_event_type" ON "notifications" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_notifications_delivery_status" ON "notifications" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id_is_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_related_entity" ON "notifications" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_next_retry_at" ON "notifications" USING btree ("next_retry_at") WHERE "delivery_status" = 'FAILED';--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trigger_update_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();
