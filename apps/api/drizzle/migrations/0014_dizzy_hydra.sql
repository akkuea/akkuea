-- Dead-letter queue for notifications that exhausted all retries
CREATE TABLE IF NOT EXISTS "notification_dlq" (
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
CREATE INDEX "transactions_hash_idx" ON "transactions" USING btree ("hash");