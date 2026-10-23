-- Lane A (Wave 1): roles and navigation foundation. Additive only — no column,
-- table, enum value or row is renamed, dropped or rewritten (docs/plans/opencode/
-- lane-a-roles-nav.md + lane-a-update-1.md + lane-a-update-2.md).
-- Matches shared/schema.ts. Applied by scripts/run-migrations.mjs.
--
-- 1. `staff` (daily DE staff / client-manager class) joins the portal role enum.
--    `admin` keeps today's meaning: the break-glass account, full access, unchanged.
--    Safe inside a transaction on PostgreSQL 12+; nothing uses the new value here.
ALTER TYPE portal_user_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. Client hats on the user record. Empty array = the legacy org-role derivation
--    in shared/permissions/types.ts applies, so no account loses access it has today.
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS client_roles jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Purchased-service entitlements per company. There is NO row by default and no
--    automated source: an entitlement menu item stays hidden until DE staff grant it
--    (lane-a-update-2.md §3).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entitlement_key') THEN
    CREATE TYPE entitlement_key AS ENUM ('cloud_edge', 'voice', 'security_awareness');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS portal_client_entitlements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  entitlement entitlement_key NOT NULL,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'de_manual',
  granted_by varchar,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT portal_client_entitlements_unique UNIQUE (client_id, entitlement)
);
CREATE INDEX IF NOT EXISTS portal_client_entitlements_client_idx
  ON portal_client_entitlements (client_id);

-- 4. "Digerati Experts" as a normal, durable company record — same id the runtime
--    already creates at startup (server/portalAuthStore.ts INTERNAL_MSP_ID), so no
--    code path special-cases it. Never overwrites an existing row.
INSERT INTO portal_clients (id, company_name, contact_email, status, service_type)
VALUES ('msp-digerati', 'Digerati Experts', 'admin@digeratiexperts.com', 'active', 'managed')
ON CONFLICT (id) DO NOTHING;

-- 5. Break-glass / DE staff action audit. break_glass marks actions taken by the
--    break-glass account (role = admin). Rows are written before the action runs.
CREATE TABLE IF NOT EXISTS portal_audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  at timestamp DEFAULT now() NOT NULL,
  actor_user_id varchar,
  actor_email text,
  account_class text,
  break_glass boolean NOT NULL DEFAULT false,
  action text NOT NULL,
  target_type text,
  target_id text,
  client_id varchar,
  ip text,
  user_agent text,
  meta jsonb
);
CREATE INDEX IF NOT EXISTS portal_audit_log_actor_idx ON portal_audit_log (actor_user_id, at DESC);
CREATE INDEX IF NOT EXISTS portal_audit_log_break_glass_idx ON portal_audit_log (at DESC) WHERE break_glass = true;
