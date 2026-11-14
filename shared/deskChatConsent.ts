/**
 * DE Desk recording-consent notice. Change DESK_CHAT_CONSENT_NOTICE and bump
 * DESK_CHAT_CONSENT_VERSION together so returning visitors are asked again.
 * The SHA-256 digest is verified in shared/deskChatConsent.test.ts.
 */

export const DESK_CHAT_CONSENT_VERSION = "de-desk-recording-v1";

export const DESK_CHAT_CONSENT_HEADING = "Before you chat";

export const DESK_CHAT_CONSENT_NOTICE =
  "DE Desk is an automated AI assistant for Digerati Experts (DE), not a person. This chat is recorded. Your messages and the transcript are stored by DE and sent to our AI service provider, which processes them only to answer you on DE's behalf. A DE team member may read the transcript to follow up or improve service. Please don't share passwords, payment card numbers, Social Security numbers, or health information in chat. By selecting \"Agree and start chat,\" you consent to this recording, storage, and processing. If you don't agree, you can reach us through our contact form, by opening a support ticket, or by phone instead. See our Privacy Policy for details.";

export const DESK_CHAT_CONSENT_NOTICE_SHA256 =
  "b45ec6247d614d8554094cda6665751ebc061a82d98be4db5ddfb656e33c579e";

export const DESK_CHAT_CONSENT_AGREE_LABEL = "Agree and start chat";

export const DESK_CHAT_CONSENT_DECLINE_LABEL = "No thanks, contact DE another way";

export const DESK_CHAT_CONSENT_PRIVACY_HREF = "/legal/privacy-policy#chat-recording";

export const DESK_CHAT_RECORDED_LABEL = "Chat is recorded";

export const DESK_CHAT_CONSENT_REQUIRED = "CHAT_CONSENT_REQUIRED";

export type DeskChatConsentPayload = {
  version: string;
  noticeHash: string;
};

export function deskChatConsentStorageKey(): string {
  return `de-desk-chat-consent:${DESK_CHAT_CONSENT_VERSION}:${DESK_CHAT_CONSENT_NOTICE_SHA256.slice(0, 16)}`;
}

export function isCurrentDeskChatConsent(value: unknown): value is DeskChatConsentPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === DESK_CHAT_CONSENT_VERSION &&
    record.noticeHash === DESK_CHAT_CONSENT_NOTICE_SHA256
  );
}

export function currentDeskChatConsent(): DeskChatConsentPayload {
  return {
    version: DESK_CHAT_CONSENT_VERSION,
    noticeHash: DESK_CHAT_CONSENT_NOTICE_SHA256,
  };
}

/** Split the notice so "Privacy Policy" can be turned into a link. */
export function splitDeskChatConsentNotice(): { before: string; after: string } {
  const label = "Privacy Policy";
  const at = DESK_CHAT_CONSENT_NOTICE.lastIndexOf(label);
  if (at < 0) return { before: DESK_CHAT_CONSENT_NOTICE, after: "" };
  return {
    before: DESK_CHAT_CONSENT_NOTICE.slice(0, at),
    after: DESK_CHAT_CONSENT_NOTICE.slice(at + label.length),
  };
}

export const DESK_CHAT_PRIOR_DESCRIPTION_NOTE = "Your earlier description is attached to this chat";

/** Optional carry-forward from the homepage situation box. */
export type DeskPriorSituationState = {
  descriptionAttached?: boolean;
};

export function deskPriorDescriptionNote(state: DeskPriorSituationState | null | undefined): string | null {
  if (!state?.descriptionAttached) return null;
  return DESK_CHAT_PRIOR_DESCRIPTION_NOTE;
}

/**
 * Wired when the homepage situation box can hand a description to DE Desk.
 * Until that flow lands, this returns null and the recording notice is always shown in full.
 */
export function readPriorSituationAttachment(): DeskPriorSituationState | null {
  return null;
}
