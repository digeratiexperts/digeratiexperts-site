import { describe, expect, it } from "vitest";
import {
  PRE_CHAT_CONSENT_VERSION,
  isPreChatConsentGranted,
} from "./preChatConsent";

describe("isPreChatConsentGranted", () => {
  it("accepts only an explicit true flag with the current version", () => {
    expect(isPreChatConsentGranted({ consent: true, consentVersion: PRE_CHAT_CONSENT_VERSION })).toBe(true);
  });

  it.each([
    {},
    { consent: true },
    { consentVersion: PRE_CHAT_CONSENT_VERSION },
    { consent: "true", consentVersion: PRE_CHAT_CONSENT_VERSION },
    { consent: 1, consentVersion: PRE_CHAT_CONSENT_VERSION },
    { consent: true, consentVersion: "old-version" },
    { consent: false, consentVersion: PRE_CHAT_CONSENT_VERSION },
    null,
    undefined,
  ])("rejects %j", (body) => {
    expect(isPreChatConsentGranted(body as never)).toBe(false);
  });
});
