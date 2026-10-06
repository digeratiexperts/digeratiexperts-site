-- Client licensing (account types + per-company licence policy) and the
-- knowledge base (articles, ratings, subscriptions). Stores verify, never
-- create, these tables. shared/licensing.ts and shared/kb.ts hold the rules.

CREATE SEQUENCE IF NOT EXISTS service_request_lic_seq START 1;

CREATE TABLE IF NOT EXISTS client_license_policies (
  client_id varchar PRIMARY KEY REFERENCES portal_clients(id) ON DELETE CASCADE,
  policy jsonb NOT NULL,
  updated_by varchar,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_user_accounts (
  user_id varchar PRIMARY KEY,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  account_type text NOT NULL,
  tier text,
  updated_by varchar,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_user_accounts_client_idx ON client_user_accounts (client_id);

CREATE SEQUENCE IF NOT EXISTS kb_number_seq START 10001;

CREATE TABLE IF NOT EXISTS kb_articles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  category text NOT NULL,
  body text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  audience_client_id varchar REFERENCES portal_clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  revised_by_name text NOT NULL DEFAULT '',
  revised_at timestamp NOT NULL DEFAULT now(),
  views integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kb_articles_status_idx ON kb_articles (status, audience_client_id);

CREATE TABLE IF NOT EXISTS kb_article_ratings (
  article_id varchar NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id varchar NOT NULL,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  rated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);

CREATE TABLE IF NOT EXISTS kb_article_subscriptions (
  article_id varchar NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id varchar NOT NULL,
  subscribed_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
