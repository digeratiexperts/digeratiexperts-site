-- Staff-entered records behind the portal's "manual" data sources
-- (VPN devices for WireGuard / OpenVPN, staff-entered shipment tracking).
-- See server/portalIntegrations.ts and server/portalManualRecords.ts.
CREATE TABLE IF NOT EXISTS portal_manual_records (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  kind text NOT NULL,
  data jsonb NOT NULL,
  created_by varchar,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_manual_records_client_kind_idx
  ON portal_manual_records (client_id, kind);
