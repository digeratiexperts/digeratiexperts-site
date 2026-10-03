-- Durable, hashed, single-use email-verification and password-reset tokens (#251, #241).
-- Raw tokens are never stored; token_hash is the SHA-256 of the emailed value.
-- Idempotent: safe if the table already exists from an earlier drizzle push.
CREATE TABLE IF NOT EXISTS portal_auth_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  purpose text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  user_id varchar NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  revoked_at timestamp
);

CREATE INDEX IF NOT EXISTS portal_auth_tokens_user_purpose_idx
  ON portal_auth_tokens (user_id, purpose)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS portal_auth_tokens_email_purpose_idx
  ON portal_auth_tokens (email, purpose, created_at DESC);
