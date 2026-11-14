import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DESK_CHAT_CONSENT_NOTICE_SHA256,
  DESK_CHAT_CONSENT_VERSION,
  deskChatConsentRequestBody,
  deskChatConsentStorageKey,
  hasStoredDeskChatConsent,
  isDeskChatConsentRequiredError,
  readStoredDeskChatConsent,
  storeDeskChatConsent,
} from "./deskChatConsent";

const KEY = deskChatConsentStorageKey();
const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: () => null,
      get length() {
        return memory.size;
      },
    } as Storage,
  };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("DE Desk consent storage", () => {
  it("remembers consent for the current version and hash only", () => {
    expect(hasStoredDeskChatConsent()).toBe(false);
    expect(readStoredDeskChatConsent()).toBeNull();
    const stored = storeDeskChatConsent();
    expect(stored).toEqual({
      version: DESK_CHAT_CONSENT_VERSION,
      noticeHash: DESK_CHAT_CONSENT_NOTICE_SHA256,
    });
    expect(hasStoredDeskChatConsent()).toBe(true);
    expect(readStoredDeskChatConsent()).toEqual(stored);
    expect(deskChatConsentRequestBody()).toEqual({ consent: stored });
  });

  it("ignores a stored value from a different notice version or hash", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: "old", noticeHash: DESK_CHAT_CONSENT_NOTICE_SHA256 }));
    expect(hasStoredDeskChatConsent()).toBe(false);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: DESK_CHAT_CONSENT_VERSION, noticeHash: "0".repeat(64) }),
    );
    expect(hasStoredDeskChatConsent()).toBe(false);
  });

  it("recognizes the consent-required error from the chat API", () => {
    expect(isDeskChatConsentRequiredError({ error: "CHAT_CONSENT_REQUIRED" }, 403)).toBe(true);
    expect(isDeskChatConsentRequiredError({ code: "CHAT_CONSENT_REQUIRED" }, 403)).toBe(true);
    expect(isDeskChatConsentRequiredError({ error: "CHAT_CONSENT_REQUIRED" }, 500)).toBe(false);
    expect(isDeskChatConsentRequiredError({ error: "nope" }, 403)).toBe(false);
  });
});
