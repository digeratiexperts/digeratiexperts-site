-- Persist authoritative checkout values for external invoice targets.
CREATE TABLE IF NOT EXISTS zoho_payment_bindings (
  payment_session_id text NOT NULL,
  target_kind text NOT NULL,
  target_id varchar NOT NULL,
  reference_number text NOT NULL,
  invoice_number text NOT NULL,
  amount_decimal text NOT NULL,
  amount_minor text NOT NULL,
  currency varchar(3) NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  expires_at timestamp NOT NULL,
  consumed_at timestamp
);

DO $$ BEGIN
  ALTER TABLE zoho_payment_bindings
    ADD CONSTRAINT zoho_payment_bindings_pkey PRIMARY KEY (payment_session_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS zoho_payment_bindings_active_target_unique
  ON zoho_payment_bindings(target_kind, target_id)
  WHERE status IN ('pending', 'consumed');

DO $$ BEGIN
  ALTER TABLE zoho_payment_bindings
    ADD CONSTRAINT zoho_payment_bindings_target_kind_check
    CHECK (target_kind = 'portal_invoice');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE zoho_payment_bindings
    ADD CONSTRAINT zoho_payment_bindings_status_check
    CHECK (status IN ('pending', 'consumed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE zoho_payment_bindings
    ADD CONSTRAINT zoho_payment_bindings_currency_check
    CHECK (currency ~ '^[A-Z]{3}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE zoho_payment_bindings
    ADD CONSTRAINT zoho_payment_bindings_amount_minor_check
    CHECK (amount_minor ~ '^[0-9]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Atomically consume each Zoho provider event/payment before a local paid transition.
CREATE TABLE IF NOT EXISTS zoho_payment_consumptions (
  event_id text NOT NULL,
  payment_id text NOT NULL,
  target_kind text NOT NULL,
  target_id varchar NOT NULL,
  payment_session_id text NOT NULL,
  reference_number text NOT NULL,
  invoice_number text NOT NULL,
  amount_decimal text NOT NULL,
  amount_minor text NOT NULL,
  currency varchar(3) NOT NULL,
  consumed_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE zoho_payment_consumptions
    ADD CONSTRAINT zoho_payment_consumptions_pkey PRIMARY KEY (event_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS zoho_payment_consumptions_payment_id_unique
  ON zoho_payment_consumptions(payment_id);

DO $$ BEGIN
  ALTER TABLE zoho_payment_consumptions
    ADD CONSTRAINT zoho_payment_consumptions_target_kind_check
    CHECK (target_kind IN ('store_order', 'portal_invoice'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE zoho_payment_consumptions
    ADD CONSTRAINT zoho_payment_consumptions_currency_check
    CHECK (currency ~ '^[A-Z]{3}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE zoho_payment_consumptions
    ADD CONSTRAINT zoho_payment_consumptions_amount_minor_check
    CHECK (amount_minor ~ '^[0-9]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reserve provider payment IDs already attached by the legacy webhook path.
-- A duplicate existing payment ID intentionally aborts this migration so it can
-- be investigated instead of silently choosing one paid order.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM store_orders
    WHERE payment_method = 'zoho'
      AND status::text IN ('paid', 'processing', 'provisioning', 'completed')
      AND (
        zoho_payment_id IS NULL
        OR zoho_payment_session_id IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce Zoho payment integrity: paid/provisioning legacy orders lack provider IDs';
  END IF;
END $$;

INSERT INTO zoho_payment_consumptions (
  event_id,
  payment_id,
  target_kind,
  target_id,
  payment_session_id,
  reference_number,
  invoice_number,
  amount_decimal,
  amount_minor,
  currency,
  consumed_at
)
SELECT
  'legacy:' || id || ':' || zoho_payment_id,
  zoho_payment_id,
  'store_order',
  id,
  COALESCE(zoho_payment_session_id, 'legacy-unknown:' || id),
  order_number,
  order_number,
  total::text,
  ROUND(total * 100)::bigint::text,
  'USD',
  COALESCE(paid_at, updated_at, created_at, now())
FROM store_orders
WHERE payment_method = 'zoho'
  AND zoho_payment_id IS NOT NULL
ON CONFLICT (event_id) DO NOTHING;

-- Prevent mixed-version or ad-hoc code from bypassing the ledger. The new
-- webhook inserts the ledger row before the paid transition in one transaction,
-- so its uncommitted row is visible to this trigger. An old application instance
-- that tries the former metadata-only update is rejected.
CREATE OR REPLACE FUNCTION enforce_zoho_store_payment_ledger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_method::text = 'zoho'
     AND NEW.status::text IN ('paid', 'processing', 'provisioning', 'completed')
     AND NOT EXISTS (
       SELECT 1
       FROM zoho_payment_consumptions consumption
       WHERE consumption.target_kind = 'store_order'
         AND consumption.target_id = NEW.id
         AND consumption.payment_id = NEW.zoho_payment_id
         AND consumption.payment_session_id = NEW.zoho_payment_session_id
         AND consumption.reference_number = NEW.order_number
         AND consumption.invoice_number = NEW.order_number
         AND consumption.amount_decimal::numeric = NEW.total
         AND consumption.currency = 'USD'
     )
  THEN
    RAISE EXCEPTION
      'Zoho store order % cannot enter % without an exact consumed-payment ledger row',
      NEW.id,
      NEW.status
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER enforce_zoho_store_payment_ledger_trigger
    BEFORE INSERT OR UPDATE OF
      status,
      payment_method,
      zoho_payment_id,
      zoho_payment_session_id,
      order_number,
      total
    ON store_orders
    FOR EACH ROW
    EXECUTE FUNCTION enforce_zoho_store_payment_ledger();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
