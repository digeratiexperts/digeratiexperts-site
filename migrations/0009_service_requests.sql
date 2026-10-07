-- Portal service requests (loaner computer, computer return). The Portal is the
-- source of truth; the Hub receives a signed copy through sync_outbox
-- (event service_request.upserted). server/serviceRequestStore.ts verifies,
-- never creates, these tables.

CREATE SEQUENCE IF NOT EXISTS service_request_lnr_seq START 1;
CREATE SEQUENCE IF NOT EXISTS service_request_rtn_seq START 1;

CREATE TABLE IF NOT EXISTS service_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  type text NOT NULL,
  account_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  requested_for_user_id varchar NOT NULL,
  submitted_by_user_id varchar NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  site_id varchar,
  site jsonb,
  custom_address jsonb,
  status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  hub_sync_status text NOT NULL DEFAULT 'not_sent',
  hub_synced_at timestamp,
  hub_last_event_id varchar,
  desk_ticket_id text,
  submitted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_requests_account_idx ON service_requests (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_requests_requested_for_idx ON service_requests (requested_for_user_id);
CREATE INDEX IF NOT EXISTS service_requests_submitted_by_idx ON service_requests (submitted_by_user_id, status);

CREATE TABLE IF NOT EXISTS service_request_attachments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id varchar NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  account_id varchar NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  data bytea NOT NULL,
  uploaded_by varchar NOT NULL,
  uploaded_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_request_attachments_request_idx ON service_request_attachments (request_id);
