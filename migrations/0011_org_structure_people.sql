-- Company structure (by site or by department), site / department leaders,
-- and the people directory (DE person IDs, company employee IDs, VIP tier,
-- away dates). Stores verify, never create, these tables. Rules live in
-- shared/orgDirectory.ts. Departments themselves stay in portal_departments.

CREATE SEQUENCE IF NOT EXISTS client_person_seq START 1;

CREATE TABLE IF NOT EXISTS client_org_profiles (
  client_id varchar PRIMARY KEY REFERENCES portal_clients(id) ON DELETE CASCADE,
  profile jsonb NOT NULL,
  updated_by varchar,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_unit_leaders (
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  unit_kind text NOT NULL CHECK (unit_kind IN ('site', 'department')),
  unit_id varchar NOT NULL,
  leader_user_id varchar,
  backup_user_id varchar,
  cc_leader boolean NOT NULL DEFAULT true,
  updated_by varchar,
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, unit_kind, unit_id)
);

CREATE TABLE IF NOT EXISTS client_people (
  user_id varchar PRIMARY KEY,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  de_person_id text NOT NULL UNIQUE,
  company_person_id text,
  site_id varchar,
  support_tier text NOT NULL DEFAULT 'standard' CHECK (support_tier IN ('standard', 'vip')),
  away_until date,
  updated_by varchar,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_people_client_idx ON client_people (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS client_people_company_id_uq
  ON client_people (client_id, lower(company_person_id))
  WHERE company_person_id IS NOT NULL;
