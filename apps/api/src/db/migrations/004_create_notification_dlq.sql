-- Dead-letter queue for notifications that exhausted all retries
CREATE TABLE notification_dlq (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The original notification payload is stored as JSON so we never lose data
  -- even after the source row is cleaned up.
  notification_id      UUID   NOT NULL,
  user_id              UUID   NOT NULL,
  event_type           TEXT   NOT NULL,
  title                TEXT   NOT NULL,
  message              TEXT   NOT NULL,
  channel              TEXT   NOT NULL,
  recipient            TEXT,
  related_entity_type  TEXT,
  related_entity_id    TEXT,
  metadata             TEXT,
  -- Delivery failure context
  last_failure_reason  TEXT,
  retry_count          INTEGER NOT NULL DEFAULT 0,
  -- Lifecycle
  requeued_at          TIMESTAMP WITH TIME ZONE,     -- set when an admin requeues the message
  requeued_by          TEXT,                         -- who triggered the requeue
  resolved_at          TIMESTAMP WITH TIME ZONE,     -- set when resolved without requeue
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_dlq_notification_id ON notification_dlq(notification_id);
CREATE INDEX idx_notification_dlq_user_id          ON notification_dlq(user_id);
CREATE INDEX idx_notification_dlq_created_at       ON notification_dlq(created_at DESC);
-- Only unresolved, un-requeued entries are interesting to admins
CREATE INDEX idx_notification_dlq_pending          ON notification_dlq(created_at DESC)
  WHERE requeued_at IS NULL AND resolved_at IS NULL;
