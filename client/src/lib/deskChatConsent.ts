import {
  currentDeskChatConsent,
  deskChatConsentStorageKey,
  isCurrentDeskChatConsent,
  type DeskChatConsentPayload,
} from "@shared/deskChatConsent";

export {
  DESK_CHAT_CONSENT_AGREE_LABEL,
  DESK_CHAT_CONSENT_DECLINE_LABEL,
  DESK_CHAT_CONSENT_HEADING,
  DESK_CHAT_CONSENT_NOTICE,
  DESK_CHAT_CONSENT_NOTICE_SHA256,
  DESK_CHAT_CONSENT_PRIVACY_HREF,
  DESK_CHAT_CONSENT_VERSION,
  DESK_CHAT_RECORDED_LABEL,
  currentDeskChatConsent,
  deskChatConsentStorageKey,
  isCurrentDeskChatConsent,
  splitDeskChatConsentNotice,
} from "@shared/deskChatConsent";

function browserStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readStoredDeskChatConsent(): DeskChatConsentPayload | null {
  const store = browserStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(deskChatConsentStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isCurrentDeskChatConsent(parsed)) return null;
    return { version: parsed.version, noticeHash: parsed.noticeHash };
  } catch {
    return null;
  }
}

export function hasStoredDeskChatConsent(): boolean {
  return readStoredDeskChatConsent() !== null;
}

export function storeDeskChatConsent(): DeskChatConsentPayload {
  const value = currentDeskChatConsent();
  try {
    browserStorage()?.setItem(
      deskChatConsentStorageKey(),
      JSON.stringify({ ...value, agreedAt: new Date().toISOString() }),
    );
  } catch {
    /* private mode or blocked storage */
  }
  return value;
}

export function deskChatConsentRequestBody(): { consent: DeskChatConsentPayload } {
  return { consent: currentDeskChatConsent() };
}

export function isDeskChatConsentRequiredError(data: unknown, status?: number): boolean {
  if (status !== undefined && status !== 403 && status !== 400) return false;
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return record.error === "CHAT_CONSENT_REQUIRED" || record.code === "CHAT_CONSENT_REQUIRED";
}
