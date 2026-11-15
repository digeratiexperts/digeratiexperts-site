import { describe, expect, it } from "vitest";
import { isOffTopicSituation, SITUATION_MATCH_OFF_TOPIC_NOTE } from "./situationMatchScope";

describe("situation match scope", () => {
  it("keeps a short fixed note and does not mention Digerati alone", () => {
    expect(SITUATION_MATCH_OFF_TOPIC_NOTE).toBe(
      "Describe an IT or security situation at your business and we'll match it.",
    );
    expect(SITUATION_MATCH_OFF_TOPIC_NOTE).not.toMatch(/Digerati(?! Experts)/);
  });

  it("flags personal chat, roleplay, trivia, and creative writing", () => {
    const off = [
      "hello there",
      "hey how are you",
      "what's your name?",
      "who are you?",
      "I'm bored, can we just chat",
      "be my friend",
      "keep me company",
      "recommend a movie",
      "let's roleplay that you are a pirate",
      "pretend you are my companion",
      "act as a wizard",
      "what's the capital of France",
      "who invented the telephone",
      "trivia: what year did the first computer ship",
      "write me a poem about the ocean",
      "write a short story about a phishing email",
      "compose a haiku",
      "tell me a joke",
      "tell me a bedtime story",
    ];
    for (const text of off) {
      expect(isOffTopicSituation(text), text).toBe(true);
    }
  });

  it("does not flag a business IT or security situation", () => {
    const on = [
      "Someone clicked a link in a fake invoice email",
      "We're moving to a bigger office in March",
      "A client wants our HIPAA policies",
      "our insurer sent a questionnaire about MFA",
      "two new hires start monday and need laptops",
      "our only IT person left and nobody knows the passwords",
      "We don't know if backups work",
      "someone clicked a fake invoice email",
      "Call me Alex Chen at 480-555-0100, we were phished",
      "who are you going to assign as our admin after our IT person left",
      "write a policy for our HIPAA audit",
    ];
    for (const text of on) {
      expect(isOffTopicSituation(text), text).toBe(false);
    }
  });

  it("treats empty input as not off-topic (the matcher already rejects it)", () => {
    expect(isOffTopicSituation("")).toBe(false);
    expect(isOffTopicSituation("   ")).toBe(false);
  });
});
