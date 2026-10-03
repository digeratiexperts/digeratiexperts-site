-- Durable tenant file metadata (#259). DatabaseStorage previously kept tenant
-- file rows in process memory even with a healthy database, so every deploy
-- erased the portal file list and orphaned the uploaded objects.
-- Idempotent: matches shared/schema.ts portalTenantFiles; safe if the table
-- already exists from an earlier drizzle push.
CREATE TABLE IF NOT EXISTS portal_tenant_files (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  description text,
  category text,
  is_public boolean DEFAULT true,
  uploaded_by varchar NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Soft delete keeps the object path on record so a blob is never orphaned
-- silently; object removal is a deliberate, separate operation.
ALTER TABLE portal_tenant_files ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE portal_tenant_files ADD COLUMN IF NOT EXISTS deleted_by varchar;

CREATE INDEX IF NOT EXISTS portal_tenant_files_client_live_idx
  ON portal_tenant_files (client_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS portal_tenant_files_file_url_idx
  ON portal_tenant_files (file_url);
