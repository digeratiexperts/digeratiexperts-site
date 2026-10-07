-- Store order controls: holds (pause fulfilment until a date) and change
-- requests (cancel a paid order, amend any open order) that DE reviews.
-- Order prices, line items and payment stay with the Store; nothing here
-- edits them. Stores verify, never create, these tables.

CREATE TABLE IF NOT EXISTS store_order_holds (
  order_id varchar PRIMARY KEY REFERENCES store_orders(id) ON DELETE CASCADE,
  client_id varchar,
  held_until date NOT NULL,
  reason text NOT NULL,
  held_by_user_id varchar,
  held_by_name text NOT NULL,
  held_by_role text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_order_change_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  client_id varchar,
  kind text NOT NULL CHECK (kind IN ('cancel', 'amend')),
  details text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'declined')),
  requested_by_user_id varchar,
  requested_by_name text NOT NULL,
  requested_by_role text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp,
  resolved_by_name text,
  resolution_note text
);

CREATE INDEX IF NOT EXISTS store_order_change_requests_order_idx ON store_order_change_requests (order_id);
CREATE INDEX IF NOT EXISTS store_order_change_requests_status_idx ON store_order_change_requests (status);
