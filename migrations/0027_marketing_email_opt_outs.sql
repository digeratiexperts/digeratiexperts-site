-- Marketing email opt-outs. One row per address that asked to stop
-- receiving marketing email, written by the one-click unsubscribe endpoint
-- and checked before every marketing send. Transactional email ignores it.
-- Addresses are stored trimmed and lower-cased. A row is never removed by the
-- application; take one out by hand only on the person's written request.
-- See server/marketingEmail.ts.
CREATE TABLE IF NOT EXISTS marketing_email_opt_outs (
  email text PRIMARY KEY,
  source text NOT NULL DEFAULT 'unsubscribe',
  opted_out_at timestamptz NOT NULL DEFAULT now()
);
