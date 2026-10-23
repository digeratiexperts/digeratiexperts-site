-- License Patch Bay -> Microsoft 365 and Google Workspace. Each client company
-- can be linked to its Microsoft tenant (tenant id or domain, and which cloud)
-- and its Google Workspace super admin (who DE's service account acts as).
-- The push log records every licence DE sent and what the vendor answered.

CREATE TABLE IF NOT EXISTS license_vendor_links (
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  vendor text NOT NULL CHECK (vendor IN ('microsoft', 'google')),
  tenant text,
  cloud text CHECK (cloud IS NULL OR cloud IN ('commercial', 'gcc', 'gcc_high')),
  admin_email text,
  updated_by varchar,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, vendor)
);

CREATE TABLE IF NOT EXISTS license_vendor_pushes (
  id varchar PRIMARY KEY,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  vendor text NOT NULL CHECK (vendor IN ('microsoft', 'google')),
  item_id varchar NOT NULL,
  product text NOT NULL,
  sku text NOT NULL,
  user_email text NOT NULL,
  ok boolean NOT NULL,
  detail text,
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS license_vendor_pushes_client_idx ON license_vendor_pushes (client_id, vendor, created_at DESC);
