-- Drop the retired Stripe columns (Stripe was replaced by Zoho Payments).
-- Step 2 of 2. Deploy ONLY after step 1 ("stop reading and writing the
-- retired Stripe columns") is live: migrations run before a release is
-- activated, so the release serving traffic during this deploy, and any
-- rollback target, must already be code that no longer selects these columns.
--
-- Before dropping, every non-empty value is copied to retired_stripe_references
-- (source table, row id, column, value). They are the only link from a
-- historical order or product to its record in Stripe (refunds, disputes,
-- accounting). Drop that table separately once nobody needs them.
--
-- Safe on any database: each copy runs only if its column still exists, and
-- every ALTER uses IF EXISTS. The store tables were first created by
-- drizzle-kit push, not by this ledger. The "stripe" value of the
-- store_payment_method enum stays: historical orders use it.

CREATE TABLE IF NOT EXISTS retired_stripe_references (
  source_table text NOT NULL,
  row_id varchar NOT NULL,
  column_name text NOT NULL,
  value text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, row_id, column_name)
);

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
     WHERE c.table_schema = current_schema()
       AND (c.table_name, c.column_name) IN (
         ('store_orders', 'stripe_session_id'),
         ('store_orders', 'stripe_payment_intent_id'),
         ('store_products', 'stripe_price_id'),
         ('store_products', 'stripe_product_id')
       )
  LOOP
    EXECUTE format(
      'INSERT INTO retired_stripe_references (source_table, row_id, column_name, value)
         SELECT %L, id::text, %L, %I::text FROM %I
          WHERE %I IS NOT NULL AND btrim(%I::text) <> ''''
       ON CONFLICT (source_table, row_id, column_name) DO NOTHING',
      target.table_name, target.column_name, target.column_name, target.table_name,
      target.column_name, target.column_name
    );
  END LOOP;
END $$;

ALTER TABLE IF EXISTS store_orders
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS stripe_payment_intent_id;

ALTER TABLE IF EXISTS store_products
  DROP COLUMN IF EXISTS stripe_price_id,
  DROP COLUMN IF EXISTS stripe_product_id;
