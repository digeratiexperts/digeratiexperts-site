-- System Status notices: incidents, maintenance windows and general notices
-- that DE staff post for one client company or for every client
-- (client_id NULL). See shared/statusNotices.ts and server/statusNoticeStore.ts.
CREATE TABLE IF NOT EXISTS portal_status_notices (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar REFERENCES portal_clients(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  affected_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  resolved_at timestamptz,
  updates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by varchar,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_status_notices_client_idx
  ON portal_status_notices (client_id, starts_at DESC);
