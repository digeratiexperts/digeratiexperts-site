-- Server-side portal session revocation (#242).
-- sessions_valid_after: JWTs issued before this instant are rejected (password reset).
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS sessions_valid_after timestamp;

-- Individually revoked tokens (logout). token_hash is SHA-256 of the JWT; rows are
-- only needed until the token's own expiry, so expires_at lets them be pruned.
CREATE TABLE IF NOT EXISTS portal_revoked_sessions (
  token_hash varchar PRIMARY KEY,
  user_id varchar,
  revoked_at timestamp DEFAULT now() NOT NULL,
  expires_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_revoked_sessions_expires_idx
  ON portal_revoked_sessions (expires_at);
