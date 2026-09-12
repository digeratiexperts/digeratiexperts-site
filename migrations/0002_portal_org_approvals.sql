-- Portal multi-role org hierarchy + approval workflow
DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE portal_org_role AS ENUM ('staff', 'manager', 'dept_it_contact', 'company_it_contact');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE portal_approval_request_status AS ENUM ('pending', 'approved', 'rejected', 'info_requested', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE portal_approval_step_type AS ENUM ('manager', 'skip_level', 'dept_it', 'company_it');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE portal_approval_step_status AS ENUM ('pending', 'approved', 'rejected', 'info_requested', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS portal_departments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  it_contact_user_id varchar,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS org_role portal_org_role DEFAULT 'staff';
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS department_id varchar REFERENCES portal_departments(id) ON DELETE SET NULL;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS manager_user_id varchar;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS is_company_it_contact boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS portal_approval_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_number text NOT NULL UNIQUE,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  requester_user_id varchar NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority ticket_priority DEFAULT 'medium',
  amount_cents integer,
  status portal_approval_request_status DEFAULT 'pending',
  payload jsonb DEFAULT '{}'::jsonb,
  fulfillment_ticket_id varchar,
  no_manager_assigned boolean DEFAULT false,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_approval_steps (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id varchar NOT NULL REFERENCES portal_approval_requests(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  step_type portal_approval_step_type NOT NULL,
  approver_user_id varchar REFERENCES portal_users(id) ON DELETE SET NULL,
  status portal_approval_step_status DEFAULT 'pending',
  note text,
  acted_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_departments_client ON portal_departments(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_client_org ON portal_users(client_id, org_role);
CREATE INDEX IF NOT EXISTS idx_portal_users_manager ON portal_users(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_approval_requests_client ON portal_approval_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_approval_steps_request ON portal_approval_steps(request_id, step_order);
CREATE INDEX IF NOT EXISTS idx_portal_approval_steps_approver ON portal_approval_steps(approver_user_id, status);
