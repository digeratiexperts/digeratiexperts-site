-- Durable Save Progress for the public Solution Builder (#120), moved out of
-- application runtime into the checksummed migration ledger (#253).
-- Idempotent: production already has this table from the former runtime
-- CREATE TABLE IF NOT EXISTS path, so this records it without changing it.
CREATE TABLE IF NOT EXISTS public_solution_requests (
  id varchar PRIMARY KEY,
  session_id varchar NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS public_solution_requests_session_idx
  ON public_solution_requests (session_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS public_solution_requests_expiry_idx
  ON public_solution_requests (status, expires_at);
CREATE INDEX IF NOT EXISTS public_solution_requests_reference_idx
  ON public_solution_requests ((payload->>'reference'));
