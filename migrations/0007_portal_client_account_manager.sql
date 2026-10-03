-- Account manager assignment per prospect/client. Holds a profile id from
-- shared/accountManagers.ts (e.g. 'joe-petro'); NULL resolves to the default.
-- The column is already in shared/schema.ts; this makes it explicit on every DB.
ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS account_manager text;
