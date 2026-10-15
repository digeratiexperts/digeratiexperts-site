-- Client Portal agreement gate (shared/portalAgreements.ts): who accepted which
-- version of each portal agreement, and the evidence of it. Company-scope rows
-- are signed once per company by someone who can bind it; user-scope rows by
-- each person. Rows are never updated or deleted by the app.

CREATE TABLE IF NOT EXISTS portal_agreement_signatures (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_key text NOT NULL,
  agreement_version text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('company', 'user')),
  client_id varchar NOT NULL,
  user_id varchar NOT NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  document_sha256 text,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now()
);

-- One company signature per version; one personal signature per person per version.
CREATE UNIQUE INDEX IF NOT EXISTS portal_agreement_company_once
  ON portal_agreement_signatures (agreement_key, agreement_version, client_id) WHERE scope = 'company';
CREATE UNIQUE INDEX IF NOT EXISTS portal_agreement_user_once
  ON portal_agreement_signatures (agreement_key, agreement_version, user_id) WHERE scope = 'user';
CREATE INDEX IF NOT EXISTS portal_agreement_client_idx ON portal_agreement_signatures (client_id);
