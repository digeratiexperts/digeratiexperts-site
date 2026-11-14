import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  DESK_CHAT_CONSENT_AGREE_LABEL,
  DESK_CHAT_CONSENT_DECLINE_LABEL,
  DESK_CHAT_CONSENT_HEADING,
  DESK_CHAT_CONSENT_NOTICE,
  DESK_CHAT_CONSENT_NOTICE_SHA256,
  DESK_CHAT_CONSENT_PRIVACY_HREF,
  DESK_CHAT_CONSENT_VERSION,
  currentDeskChatConsent,
  deskChatConsentStorageKey,
  deskPriorDescriptionNote,
  isCurrentDeskChatConsent,
  readPriorSituationAttachment,
  splitDeskChatConsentNotice,
  DESK_CHAT_PRIOR_DESCRIPTION_NOTE,
} from "./deskChatConsent";

describe("DE Desk recording consent notice", () => {
  it("exports a versioned notice whose hash matches the exact text", () => {
    expect(DESK_CHAT_CONSENT_VERSION).toBe("de-desk-recording-v1");
    expect(DESK_CHAT_CONSENT_HEADING).toBe("Before you chat");
    expect(DESK_CHAT_CONSENT_AGREE_LABEL).toBe("Agree and start chat");
    expect(DESK_CHAT_CONSENT_DECLINE_LABEL).toBe("No thanks, contact DE another way");
    expect(DESK_CHAT_CONSENT_PRIVACY_HREF).toBe("/legal/privacy-policy#chat-recording");
    expect(DESK_CHAT_CONSENT_NOTICE).toBe(
      'DE Desk is an automated AI assistant for Digerati Experts (DE), not a person. This chat is recorded. Your messages and the transcript are stored by DE and sent to our AI service provider, which processes them only to answer you on DE\'s behalf. A DE team member may read the transcript to follow up or improve service. Please don\'t share passwords, payment card numbers, Social Security numbers, or health information in chat. By selecting "Agree and start chat," you consent to this recording, storage, and processing. If you don\'t agree, you can reach us through our contact form, by opening a support ticket, or by phone instead. See our Privacy Policy for details.',
    );
    expect(createHash("sha256").update(DESK_CHAT_CONSENT_NOTICE, "utf8").digest("hex")).toBe(
      DESK_CHAT_CONSENT_NOTICE_SHA256,
    );
    expect(DESK_CHAT_CONSENT_NOTICE_SHA256).toHaveLength(64);
  });

  it("treats only the current version and hash as valid consent", () => {
    const current = currentDeskChatConsent();
    expect(isCurrentDeskChatConsent(current)).toBe(true);
    expect(isCurrentDeskChatConsent({ ...current, version: "old" })).toBe(false);
    expect(isCurrentDeskChatConsent({ ...current, noticeHash: "0".repeat(64) })).toBe(false);
    expect(isCurrentDeskChatConsent(null)).toBe(false);
    expect(deskChatConsentStorageKey()).toContain(DESK_CHAT_CONSENT_VERSION);
    expect(deskChatConsentStorageKey()).toContain(DESK_CHAT_CONSENT_NOTICE_SHA256.slice(0, 16));
    const parts = splitDeskChatConsentNotice();
    expect(`${parts.before}Privacy Policy${parts.after}`).toBe(DESK_CHAT_CONSENT_NOTICE);
  });

  it("can note a description already attached from an earlier agree step", () => {
    expect(DESK_CHAT_PRIOR_DESCRIPTION_NOTE).toBe("Your earlier description is attached to this chat");
    expect(deskPriorDescriptionNote(null)).toBeNull();
    expect(deskPriorDescriptionNote({})).toBeNull();
    expect(deskPriorDescriptionNote({ descriptionAttached: false })).toBeNull();
    expect(deskPriorDescriptionNote({ descriptionAttached: true })).toBe(DESK_CHAT_PRIOR_DESCRIPTION_NOTE);
    expect(readPriorSituationAttachment()).toBeNull();
  });
});
