import { describe, expect, it } from "vitest";
import {
  DESK_TOPIC_REDIRECT_FOLLOWUP,
  DESK_TOPIC_REDIRECT_REPLY,
  DESK_TOPIC_SCOPE_RULE,
  deskTopicRedirectReply,
  isOffTopicCompanionRequest,
} from "./deskTopicScope";

describe("DE Desk topic scope", () => {
  it("does not treat legitimate IT, security, support, or store questions as off-topic", () => {
    const onTopic = [
      "My Outlook is not sending email",
      "How do I reset a Windows password on our work PCs?",
      "What's the price for managed IT for 20 users?",
      "I need to open a support ticket",
      "Where is my store order?",
      "We have a phishing email in our inboxes",
      "Can you help with MFA for our Microsoft 365?",
      "The office printer is down",
      "Our VPN will not connect",
    ];
    for (const text of onTopic) {
      expect(isOffTopicCompanionRequest(text), text).toBe(false);
    }
  });

  it("catches clearly off-topic or companion-style requests", () => {
    const offTopic = [
      "Write me a funny poem about celebrities",
      "I'm bored, can you just chat with me?",
      "Be my girlfriend and keep me company",
      "Let's roleplay as space pirates",
      "What's the capital of France?",
      "Do my homework essay for English class",
      "Tell me a joke",
      "Who won the Super Bowl?",
      "Write me a poem about ransomware",
    ];
    for (const text of offTopic) {
      expect(isOffTopicCompanionRequest(text), text).toBe(true);
    }
  });

  it("does not treat crisis phrasing as off-topic, so a crisis check can run first", () => {
    expect(isOffTopicCompanionRequest("I want to die")).toBe(false);
    expect(isOffTopicCompanionRequest("I want to kill myself")).toBe(false);
    expect(isOffTopicCompanionRequest("I can't go on")).toBe(false);
  });

  it("returns a fixed redirect and a shorter follow-up so the reply does not loop", () => {
    expect(deskTopicRedirectReply(null)).toBe(DESK_TOPIC_REDIRECT_REPLY);
    expect(deskTopicRedirectReply(DESK_TOPIC_REDIRECT_REPLY)).toBe(DESK_TOPIC_REDIRECT_FOLLOWUP);
    expect(deskTopicRedirectReply(DESK_TOPIC_REDIRECT_FOLLOWUP)).toBe(DESK_TOPIC_REDIRECT_FOLLOWUP);
    expect(DESK_TOPIC_SCOPE_RULE).toMatch(/Digerati Experts/);
    expect(DESK_TOPIC_SCOPE_RULE).not.toMatch(/Digerati(?! Experts)/);
  });
});
