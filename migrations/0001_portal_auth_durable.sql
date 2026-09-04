-- Durable portal auth: extend portal_users / portal_clients for production login.
DO $$ BEGIN
  CREATE TYPE store_role AS ENUM ('public', 'prospect', 'managed', 'comanaged', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'prospect';

ALTER TABLE portal_users ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS store_role store_role DEFAULT 'prospect';
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_method text;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_totp_secret text;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_backup_codes jsonb DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE portal_users ADD CONSTRAINT portal_users_username_unique UNIQUE (username);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS portal_order_forms (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar REFERENCES portal_users(id) ON DELETE SET NULL,
  client_id varchar REFERENCES portal_clients(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'submitted',
  created_at timestamp DEFAULT now() NOT NULL
);
