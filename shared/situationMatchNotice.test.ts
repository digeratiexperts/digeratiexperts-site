import { describe, expect, it } from "vitest";
import {
  CHAT_RETENTION,
  HEALTH_INFO_WARNING,
  looksLikeHealthInfo,
  SITUATION_MATCH_AI_DISCLOSURE,
  SITUATION_MATCH_NO_TRAINING,
  SITUATION_MATCH_NOTICE_VERSION,
} from "./situationMatchNotice";

describe("SITUATION_MATCH_AI_DISCLOSURE", () => {
  it("uses the approved notice text, with a retention placeholder and a no-training clause that can be dropped", () => {
    expect(CHAT_RETENTION).toBe("{{CHAT_RETENTION}}");
    expect(SITUATION_MATCH_NOTICE_VERSION).toBe("situation-match-v2");
    expect(SITUATION_MATCH_AI_DISCLOSURE).toBe(
      "An AI assistant for Digerati Experts (DE) reads your description to suggest services. We send it to our AI service provider, which is not allowed to use it to train its models, and keep it in your session for {{CHAT_RETENTION}} so DE Desk can pick up where you left off. It is not saved to an IT & Security Profile unless you later choose to save a draft. Please don't include passwords, card numbers, or health or patient information. See our Privacy Policy.",
    );
    expect(SITUATION_MATCH_AI_DISCLOSURE).toContain(SITUATION_MATCH_NO_TRAINING);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toContain(CHAT_RETENTION);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toMatch(/See our Privacy Policy\./);
    expect(SITUATION_MATCH_AI_DISCLOSURE).not.toMatch(/Digerati(?! Experts)/);
  });
});

describe("looksLikeHealthInfo", () => {
  it("flags obvious health or patient terms and ignores ordinary business wording", () => {
    expect(looksLikeHealthInfo("the diagnosis is on the form")).toBe(true);
    expect(looksLikeHealthInfo("a patient called about email")).toBe(true);
    expect(looksLikeHealthInfo("this may be PHI")).toBe(true);
    expect(looksLikeHealthInfo("we cannot find the medical record")).toBe(true);
    expect(looksLikeHealthInfo("the prescription queue is down")).toBe(true);
    expect(looksLikeHealthInfo("someone clicked a fake invoice email")).toBe(false);
    expect(looksLikeHealthInfo("we are patiently waiting on laptops")).toBe(false);
    expect(HEALTH_INFO_WARNING).toMatch(/still continue/i);
  });
});
