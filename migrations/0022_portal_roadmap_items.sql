-- IT Roadmap items DE writes per client company; the company's owners comment
-- and approve or decline them. See shared/roadmap.ts and server/roadmapStore.ts.
CREATE TABLE IF NOT EXISTS portal_roadmap_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  category text NOT NULL,
  priority text NOT NULL,
  target_quarter text NOT NULL,
  estimate_low integer,
  estimate_high integer,
  cost_basis text NOT NULL DEFAULT 'one_time',
  status text NOT NULL DEFAULT 'proposed',
  decision_note text NOT NULL DEFAULT '',
  decided_by_name text,
  decided_at timestamptz,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by varchar,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_roadmap_items_client_idx
  ON portal_roadmap_items (client_id, target_quarter);
