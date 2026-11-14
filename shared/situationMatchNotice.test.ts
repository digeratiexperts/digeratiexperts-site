import { describe, expect, it } from "vitest";
import { ADVISOR_SESSION_IDLE_TTL_HOURS, formatAdvisorSessionIdleTtl } from "./advisorSessionTtl";
import {
  CHAT_RETENTION,
  HEALTH_INFO_WARNING,
  looksLikeHealthInfo,
  SITUATION_MATCH_AI_DISCLOSURE,
  SITUATION_MATCH_NO_TRAINING,
  SITUATION_MATCH_NOTICE_VERSION,
} from "./situationMatchNotice";

describe("SITUATION_MATCH_AI_DISCLOSURE", () => {
  it("uses the approved notice text, with the session idle TTL, a 1-year DE Desk period, and a no-training clause that can be dropped", () => {
    expect(CHAT_RETENTION).toBe("1 year");
    expect(formatAdvisorSessionIdleTtl()).toBe("2 hours");
    expect(ADVISOR_SESSION_IDLE_TTL_HOURS).toBe(2);
    expect(SITUATION_MATCH_NOTICE_VERSION).toBe("situation-match-v4");
    expect(SITUATION_MATCH_AI_DISCLOSURE).toBe(
      "An AI assistant for Digerati Experts (DE) reads your description to suggest services. We send it to our AI service provider, which is not allowed to use it to train its models. We keep what you type here for up to 2 hours of inactivity so DE Desk can pick up where you left off. If you continue in DE Desk, your description becomes part of that chat, which we keep for 1 year. Don't enter passwords, card numbers, or health information. See our Privacy Policy.",
    );
    expect(SITUATION_MATCH_AI_DISCLOSURE).toContain(SITUATION_MATCH_NO_TRAINING);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toContain(CHAT_RETENTION);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toContain(`for up to ${formatAdvisorSessionIdleTtl()} of inactivity`);
    expect(SITUATION_MATCH_AI_DISCLOSURE).not.toMatch(/If you create an account/);
    expect(SITUATION_MATCH_AI_DISCLOSURE).not.toMatch(/IT & Security Profile/);
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
