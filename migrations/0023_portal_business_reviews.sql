-- Business reviews DE writes per client meeting: summary, decisions, linked
-- roadmap items and the report file. Owners see published ones.
-- See shared/businessReviews.ts and server/businessReviewStore.ts.
CREATE TABLE IF NOT EXISTS portal_business_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  period text,
  meeting_on date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  summary text NOT NULL DEFAULT '',
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  roadmap_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_id varchar,
  created_by varchar,
  created_by_name text NOT NULL DEFAULT '',
  published_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_business_reviews_client_idx
  ON portal_business_reviews (client_id, meeting_on DESC);
