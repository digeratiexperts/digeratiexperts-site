import { beforeEach, describe, expect, it } from "vitest";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { handleAdvisorChat } from "./services/msp-advisor/advisor";
import { AI_IDENTITY_REPLY, isAskingAiIdentity } from "./services/msp-advisor/identity";
import { _resetSessionsForTests } from "./services/msp-advisor/session";

beforeEach(() => {
  _resetSessionsForTests();
});

describe("AI identity guard", () => {
  it("recognizes questions about being a human, bot, robot, or AI, and ignores complaints", () => {
    for (const ask of [
      "are you human",
      "Are you a human?",
      "are you a bot",
      "are you a robot",
      "Are you a robot?",
      "are you AI",
      "are you an AI?",
      "who are you",
      "am I talking to a bot",
      "is this AI",
    ]) {
      expect(isAskingAiIdentity(ask), ask).toBe(true);
    }
    for (const notAsk of [
      "you sound like a robot",
      "this reply is canned and scripted",
      "I need a real person",
      "human please",
      "how do we use AI for email filtering",
      "who are you working with",
    ]) {
      expect(isAskingAiIdentity(notAsk), notAsk).toBe(false);
    }
  });

  it.each(["are you human?", "are you a bot", "Are you a robot?", "are you AI"])(
    "returns the fixed identity reply for %s and never asks for a name or apologizes for canned language",
    async (ask) => {
      const res = await handleAdvisorChat({ message: ask });
      expect(res.reply).toBe(AI_IDENTITY_REPLY);
      expect(res.reply).toContain(PRIMARY_PHONE.display);
      expect(res.reply).not.toMatch(/what'?s your name|drop the script|You're right/i);
      expect(res.actions.some((a) => a.type === "leave_message")).toBe(true);
      expect(res.actions.some((a) => a.type === "request_callback")).toBe(true);
    },
  );
});