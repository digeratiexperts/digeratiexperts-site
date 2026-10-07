-- Client vault: contracts, provisioning scripts, agent installers and PII
-- documents that DE admins keep per client. File bytes are encrypted in the
-- app (AES-256-GCM, per-item data key wrapped by VAULT_ENCRYPTION_KEY) and
-- stored in object storage; these tables hold metadata and the audit trail
-- only. Clients never read these tables, including through "View as".

CREATE TABLE IF NOT EXISTS client_vault_items (
  id varchar PRIMARY KEY,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('contract', 'script', 'agent', 'pii')),
  title text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text NOT NULL,
  object_key text NOT NULL,
  wrapped_key text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  data_iv text NOT NULL,
  data_tag text NOT NULL,
  notes text,
  created_by_user_id varchar,
  created_by_email text,
  created_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  deleted_by_email text
);

CREATE INDEX IF NOT EXISTS client_vault_items_client_idx
  ON client_vault_items (client_id, kind) WHERE deleted_at IS NULL;

-- Append-only audit of every vault access, including refusals.
CREATE TABLE IF NOT EXISTS client_vault_audit (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id varchar NOT NULL,
  item_id varchar,
  action text NOT NULL,
  outcome text NOT NULL,
  detail text,
  actor_user_id varchar,
  actor_email text,
  ip text,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_vault_audit_client_idx
  ON client_vault_audit (client_id, created_at DESC);
