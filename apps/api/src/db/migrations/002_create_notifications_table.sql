-- Create enum types for notifications
CREATE TYPE notification_event_type AS ENUM (
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VALUATION_UPDATED',
  'REPAYMENT_REMINDER',
  'REPAYMENT_OVERDUE',
  'REPAYMENT_PROCESSED',
  'RISK_WARNING',
  'LIQUIDATION_RISK',
  'SYSTEM_ALERT',
  'INVESTMENT_OPPORTUNITY',
  'PORTFOLIO_UPDATE'
);

CREATE TYPE notification_channel AS ENUM (
  'IN_APP',
  'EMAIL',
  'SMS'
);

CREATE TYPE notification_delivery_status AS ENUM (
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'BOUNCED'
);

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type notification_event_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(255),
  channel notification_channel NOT NULL,
  delivery_status notification_delivery_status NOT NULL DEFAULT 'PENDING',
  recipient VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count VARCHAR(3) NOT NULL DEFAULT '0',
  max_retries VARCHAR(3) NOT NULL DEFAULT '3',
  next_retry_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_event_type ON notifications(event_type);
CREATE INDEX idx_notifications_delivery_status ON notifications(delivery_status);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_user_id_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_related_entity ON notifications(related_entity_type, related_entity_id);
CREATE INDEX idx_notifications_next_retry_at ON notifications(next_retry_at) WHERE delivery_status = 'FAILED';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();