/**
 * Shared check for an explicit agree step before visitor text is sent to an
 * AI provider or stored on a session. Situation match uses this until the
 * site-wide DE Desk pre-chat consent helper becomes the single source.
 */

export const PRE_CHAT_CONSENT_VERSION = "de-desk-pre-chat-v1";

export const PRE_CHAT_CONSENT_REQUIRED_MESSAGE =
  "Please agree before we send what you typed to an AI assistant.";

export type PreChatConsentFields = {
  consent?: unknown;
  consentVersion?: unknown;
};

export function isPreChatConsentGranted(
  body: PreChatConsentFields | null | undefined,
  version: string = PRE_CHAT_CONSENT_VERSION,
): boolean {
  if (!body) return false;
  return body.consent === true && body.consentVersion === version;
}
