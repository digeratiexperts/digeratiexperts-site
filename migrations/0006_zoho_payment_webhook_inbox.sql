-- Signed Zoho Payment events are acknowledged after this durable insert, then
-- processed asynchronously. Only the normalized payment envelope is stored.
CREATE TABLE IF NOT EXISTS zoho_payment_webhook_inbox (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zoho_payment_webhook_inbox_status_check
    CHECK (status IN ('pending', 'processing', 'processed', 'requires_action', 'rejected')),
  CONSTRAINT zoho_payment_webhook_inbox_attempt_count_check
    CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS zoho_payment_webhook_inbox_pending_idx
  ON zoho_payment_webhook_inbox (next_attempt_at, received_at)
  WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS zoho_payment_exceptions (
  event_id text PRIMARY KEY REFERENCES zoho_payment_webhook_inbox(event_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payment_id text,
  payment_session_id text,
  reference_number text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by varchar
);

CREATE INDEX IF NOT EXISTS zoho_payment_exceptions_open_idx
  ON zoho_payment_exceptions (created_at)
  WHERE acknowledged_at IS NULL;
