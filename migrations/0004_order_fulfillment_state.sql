-- Canonical crash-recovery and external-effect ledger for paid order fulfillment.
-- The service retains an additive CREATE IF NOT EXISTS bootstrap so a mixed-version
-- rollout can recover safely before this migration has reached every instance.
CREATE TABLE IF NOT EXISTS store_order_fulfillment_state (
  order_id varchar PRIMARY KEY REFERENCES store_orders(id) ON DELETE CASCADE,
  claim_token uuid,
  claim_started_at timestamp,
  confirmation_state text NOT NULL DEFAULT 'pending',
  desk_ticket_state text NOT NULL DEFAULT 'pending',
  desk_ticket_id varchar,
  last_error text,
  completed_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE store_order_fulfillment_state
  DROP CONSTRAINT IF EXISTS store_order_fulfillment_confirmation_state_check;
ALTER TABLE store_order_fulfillment_state
  ADD CONSTRAINT store_order_fulfillment_confirmation_state_check
  CHECK (confirmation_state IN ('pending', 'reserved', 'sent', 'failed', 'skipped'));

ALTER TABLE store_order_fulfillment_state
  DROP CONSTRAINT IF EXISTS store_order_fulfillment_desk_state_check;
ALTER TABLE store_order_fulfillment_state
  ADD CONSTRAINT store_order_fulfillment_desk_state_check
  CHECK (desk_ticket_state IN ('pending', 'creating', 'completed', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS store_order_fulfillment_recovery_idx
  ON store_order_fulfillment_state (desk_ticket_state, updated_at);

CREATE INDEX IF NOT EXISTS store_orders_fulfillment_queue_idx
  ON store_orders (status, updated_at)
  WHERE status IN ('paid', 'provisioning');
