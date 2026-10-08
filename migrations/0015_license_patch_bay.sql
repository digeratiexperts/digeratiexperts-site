-- License patch bay (DE admin): DE's pool of vendor licences, the seats each
-- client company holds, and the department / person / device each seat is
-- meant for. One row per seat. Records only: nothing here provisions a
-- licence at the vendor. See shared/licenseBoard.ts.

CREATE TABLE IF NOT EXISTS license_pool_items (
  id varchar PRIMARY KEY,
  -- 'license': counted seats; 'app': software turned on per company, no seat count.
  kind text NOT NULL DEFAULT 'license' CHECK (kind IN ('license', 'app')),
  vendor text NOT NULL,
  product text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  catalog_key text,
  sku text,
  -- Chocolatey package id: what JumpCloud Software Management installs on Windows.
  choco_package text,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_allocations (
  id varchar PRIMARY KEY,
  item_id varchar NOT NULL REFERENCES license_pool_items(id) ON DELETE RESTRICT,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('pool', 'order')),
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS license_allocations_client_idx ON license_allocations (client_id, item_id);
CREATE INDEX IF NOT EXISTS license_allocations_item_idx ON license_allocations (item_id);

CREATE TABLE IF NOT EXISTS license_assignments (
  id varchar PRIMARY KEY,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  item_id varchar NOT NULL REFERENCES license_pool_items(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('department', 'user', 'device')),
  target_id varchar NOT NULL,
  target_label text NOT NULL,
  via_department_id varchar,
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS license_assignments_client_idx ON license_assignments (client_id, item_id);
