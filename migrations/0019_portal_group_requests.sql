-- Group-level requests filed by Hub-defined representatives on behalf of the
-- site or department they represent. Rules: shared/representation.ts.
-- Contract: docs/PORTAL-REPRESENTATION-CONTRACT.md. Additive only.

CREATE TABLE IF NOT EXISTS portal_group_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  hub_account_id varchar NOT NULL,
  scope_key text NOT NULL CHECK (scope_key ~ '^(account|site:[0-9]+|unit:[0-9]+)$'),
  group_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('group_request', 'equipment_collection', 'technology_assessment', 'group_concern')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_progress', 'resolved', 'closed')),
  submitted_by_user_id varchar NOT NULL,
  submitted_by_role text NOT NULL CHECK (submitted_by_role IN ('primary', 'backup')),
  desk_ticket_id varchar,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_group_requests_client_scope_idx ON portal_group_requests (client_id, scope_key, created_at);
