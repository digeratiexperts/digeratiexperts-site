import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  DESK_CHAT_CONSENT_AGREE_LABEL,
  DESK_CHAT_CONSENT_DECLINE_LABEL,
  DESK_CHAT_CONSENT_HEADING,
  DESK_CHAT_CONSENT_NOTICE,
  DESK_CHAT_CONSENT_PRIVACY_HREF,
  DESK_CHAT_CONSENT_VERSION,
  splitDeskChatConsentNotice,
} from "@/lib/deskChatConsent";

const src = readFileSync(new URL("./DeskChatConsentGate.tsx", import.meta.url), "utf8");

describe("DeskChatConsentGate", () => {
  it("renders the official notice, versioned labels, and equal action buttons", () => {
    expect(src).toContain("DESK_CHAT_CONSENT_HEADING");
    expect(src).toContain("splitDeskChatConsentNotice");
    expect(src).toContain("DESK_CHAT_CONSENT_AGREE_LABEL");
    expect(src).toContain("DESK_CHAT_CONSENT_DECLINE_LABEL");
    expect(src).toContain("DESK_CHAT_CONSENT_PRIVACY_HREF");
    expect(src).toContain('data-testid="desk-chat-consent-agree"');
    expect(src).toContain('data-testid="desk-chat-consent-decline"');
    expect(src).not.toContain("type=\"checkbox\"");
    expect(src).not.toContain("defaultChecked");
    expect(src).not.toContain("checked={true}");
    expect(src).toContain("PRIMARY_PHONE");
    expect(DESK_CHAT_CONSENT_HEADING).toBe("Before you chat");
    expect(DESK_CHAT_CONSENT_AGREE_LABEL).toBe("Agree and start chat");
    expect(DESK_CHAT_CONSENT_DECLINE_LABEL).toBe("No thanks, contact DE another way");
    expect(DESK_CHAT_CONSENT_PRIVACY_HREF).toBe("/legal/privacy-policy#chat-recording");
    expect(DESK_CHAT_CONSENT_VERSION).toMatch(/^de-desk-recording-v/);
    const parts = splitDeskChatConsentNotice();
    expect(`${parts.before}Privacy Policy${parts.after}`).toBe(DESK_CHAT_CONSENT_NOTICE);
  });
});
