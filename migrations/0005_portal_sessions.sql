-- Durable, revocable Portal browser sessions. Only a SHA-256 digest of the
-- opaque cookie value is persisted; raw bearer-equivalent session IDs never
-- enter PostgreSQL.
CREATE TABLE IF NOT EXISTS portal_sessions (
  session_hash varchar(64) PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_rotated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT portal_sessions_hash_length_check CHECK (length(session_hash) = 64),
  CONSTRAINT portal_sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS portal_sessions_user_idx
  ON portal_sessions (user_id);

CREATE INDEX IF NOT EXISTS portal_sessions_expires_idx
  ON portal_sessions (expires_at);

CREATE INDEX IF NOT EXISTS portal_sessions_revoked_idx
  ON portal_sessions (revoked_at);
