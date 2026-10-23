-- Which starter kit (business type) each client company has, and the vault
-- documents that business type needs. Applying a kit in the License Patch
-- Bay records the kit and adds its document checklist; a requirement counts
-- as on file once a vault item of the same kind has the same title.

CREATE TABLE IF NOT EXISTS license_company_kits (
  client_id varchar PRIMARY KEY REFERENCES portal_clients(id) ON DELETE CASCADE,
  kit_key text NOT NULL CHECK (kit_key IN ('regular', 'regulated', 'gcc-high')),
  applied_by varchar,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_vault_requirements (
  id varchar PRIMARY KEY,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('contract', 'script', 'agent', 'pii')),
  title text NOT NULL,
  hint text,
  source text NOT NULL,
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_vault_requirements_title_idx
  ON client_vault_requirements (client_id, kind, lower(title));
