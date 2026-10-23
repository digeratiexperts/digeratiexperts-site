-- DE Questionnaires: a portal survey assigned to one person at a client company
-- with a due date; the person saves a draft and submits, DE reviews. Answers
-- live here so a questionnaire can be assigned again later.
-- See shared/questionnaires.ts and server/questionnaireStore.ts.
CREATE TABLE IF NOT EXISTS portal_questionnaire_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
  survey_id varchar NOT NULL,
  assigned_to_user_id varchar NOT NULL,
  due_on date NOT NULL,
  status text NOT NULL DEFAULT 'assigned',
  note text NOT NULL DEFAULT '',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_by varchar,
  assigned_by_name text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_questionnaire_assignments_user_idx
  ON portal_questionnaire_assignments (assigned_to_user_id, status);
CREATE INDEX IF NOT EXISTS portal_questionnaire_assignments_due_idx
  ON portal_questionnaire_assignments (due_on);
