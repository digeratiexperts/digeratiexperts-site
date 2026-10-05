-- WebAuthn passkeys per portal user (Apple, Android, Microsoft Authenticator, JumpCloud).
-- Each entry holds a credential id, a public key, a signature counter and a provider
-- label. No secrets. portalAuthStore.ensureSchema also adds it at boot.
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_passkeys jsonb DEFAULT '[]'::jsonb;
