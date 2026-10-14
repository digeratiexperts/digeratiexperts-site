-- Zoho OAuth token store (server/zoho/oauth/db-store.ts). Additive only.
--
-- provider 'zoho': the Zoho Connect grant (one refresh token for CRM, Desk,
--   Books and Payments). refresh_token is encrypted (enc:v1, AES-256-GCM).
-- provider 'env:<fingerprint>': cached access token and health for a legacy
--   env refresh token (ZOHO_REFRESH_TOKEN, ZOHO_DESK_REFRESH_TOKEN, ...).
--   refresh_token stays NULL: the env token is never copied here.
-- access_token is encrypted too. Health columns follow
-- docs/ZOHO-OAUTH-INVENTORY.md (auth_status: ok, degraded, revoked, client_error).

CREATE TABLE IF NOT EXISTS zoho_oauth_tokens (
  provider text PRIMARY KEY,
  refresh_token text,
  refresh_fingerprint text,
  client_id text,
  org_id text,
  api_domain text,
  accounts_server text,
  scope text,
  access_token text,
  access_expires_at timestamptz,
  auth_status text CHECK (auth_status IS NULL OR auth_status IN ('ok', 'degraded', 'revoked', 'client_error')),
  last_error text,
  last_error_at timestamptz,
  last_success_at timestamptz,
  next_attempt_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
