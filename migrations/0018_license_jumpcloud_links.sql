-- License Patch Bay -> JumpCloud. Each client company can be linked to a
-- JumpCloud organization (DE's MSP portal: one org per client) and/or the
-- device group that holds its machines ("Every machine" installs go there).
-- The push log records every install DE sent and what JumpCloud answered.

CREATE TABLE IF NOT EXISTS license_jumpcloud_links (
  client_id varchar PRIMARY KEY REFERENCES portal_clients(id) ON DELETE CASCADE,
  org_id text,
  system_group_id text,
  updated_by varchar,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_jumpcloud_pushes (
  id varchar PRIMARY KEY,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  item_id varchar NOT NULL,
  product text NOT NULL,
  choco_package text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('group', 'machine')),
  target_label text NOT NULL,
  ok boolean NOT NULL,
  detail text,
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS license_jumpcloud_pushes_client_idx ON license_jumpcloud_pushes (client_id, created_at DESC);
