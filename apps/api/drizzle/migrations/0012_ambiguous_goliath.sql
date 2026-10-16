-- Dead-letter queue for notifications that exhausted all retries
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
  "retry_count" integer NOT NULL DEFAULT 0,
  "requeued_at" timestamp with time zone,
  "requeued_by" text,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "kyc_documents_user_id_idx" ON "kyc_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kyc_documents_user_id_type_idx" ON "kyc_documents" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "properties_owner_id_idx" ON "properties" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "borrow_positions_pool_id_borrower_id_idx" ON "borrow_positions" USING btree ("pool_id","borrower_id");--> statement-breakpoint
CREATE INDEX "deposit_positions_pool_id_depositor_id_idx" ON "deposit_positions" USING btree ("pool_id","depositor_id");--> statement-breakpoint
CREATE INDEX "transactions_hash_idx" ON "transactions" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id_created_at" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notifications_event_type" ON "notifications" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_notifications_delivery_status" ON "notifications" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id_is_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_related_entity" ON "notifications" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_next_retry_at" ON "notifications" USING btree ("next_retry_at") WHERE "notifications"."delivery_status" = 'FAILED';