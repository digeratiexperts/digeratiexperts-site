import { describe, expect, it } from "vitest";
import { CRISIS_REPLY, isCrisisMessage } from "./deskCrisis";
import { isOffTopicCompanionRequest } from "./deskTopicScope";

describe("DE Desk crisis check", () => {
  it("matches self-harm and suicide phrasing", () => {
    const hits = [
      "I want to kill myself",
      "thinking about suicide",
      "I am suicidal",
      "I'm going to end my life",
      "I want to be dead",
      "wish I were dead",
      "better off dead",
      "I don't want to live",
      "no reason to live",
      "planning to hurt myself",
      "I can't go on",
      "self-harm tonight",
      "I'm going to hang myself",
      "I'm lonely and want to die",
      "honestly just wanna die",
    ];
    for (const text of hits) {
      expect(isCrisisMessage(text), text).toBe(true);
    }
  });

  it("does not match ordinary IT, sales, or casual wording", () => {
    const misses = [
      "kill the stuck process on the server",
      "this job is killing me, I need a faster laptop",
      "the battery is dead",
      "please close this ticket when you can",
      "please hang up and call back",
      "cut over the network this weekend",
      "our suicide squeeze bunt in the company softball game",
      "can you help with a password reset?",
      "I need to end my subscription",
      "take my life insurance paperwork off the shared drive",
      "the old server is going to die soon, we need a replacement",
      "I want to diet before the company picnic",
    ];
    for (const text of misses) {
      expect(isCrisisMessage(text), text).toBe(false);
    }
  });

  it("returns the fixed 988 and 911 resource message", () => {
    expect(CRISIS_REPLY).toContain("988");
    expect(CRISIS_REPLY).toContain("Suicide & Crisis Lifeline");
    expect(CRISIS_REPLY).toContain("911");
    expect(CRISIS_REPLY).toContain("741741");
  });
});

describe("crisis check comes before the topic-scope guard", () => {
  it("reads lonely-and-crisis wording as crisis even though it also looks like companion chat", () => {
    const text = "I'm lonely and want to die";
    expect(isOffTopicCompanionRequest(text)).toBe(true);
    expect(isCrisisMessage(text)).toBe(true);
  });
});
