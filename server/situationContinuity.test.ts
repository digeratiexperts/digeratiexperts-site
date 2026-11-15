import { describe, expect, it } from "vitest";
import { createEmptyProfile } from "./services/msp-advisor/profile";
import { buildSystemPrompt } from "./services/msp-advisor/prompt";
import { formatPublicSituationContext, type SessionSituation } from "./services/msp-advisor/situation-match";

const situation: SessionSituation = {
  text: "My name is Alex Chen, email alex@example.com, we were phished. Meet us at 123 Main Street.",
  at: 1,
  scenarioIds: ["phishing-close-call"],
  familyIds: ["security_awareness"],
  serviceIds: ["security-awareness-training"],
  pageServiceIds: [],
  intentIds: ["phish"],
  summary: "It sounds like someone on the team clicked a message they should not have.",
};

describe("situation match as DE Desk turn context", () => {
  it("formats only allow-listed public fields and never the visitor's raw text", () => {
    const ctx = formatPublicSituationContext(situation);
    expect(ctx).toContain("phishing-close-call");
    expect(ctx).toContain("security_awareness");
    expect(ctx).toContain(situation.summary);
    expect(ctx).not.toContain("Alex Chen");
    expect(ctx).not.toContain("alex@example.com");
    expect(ctx).not.toContain("123 Main Street");
    expect(ctx).not.toContain(situation.text);
  });

  it("injects the allow-listed context into the advisor prompt", () => {
    const prompt = buildSystemPrompt({
      mode: "cybersecurity",
      knowledge: "Use MFA and report suspicious mail.",
      profile: createEmptyProfile(),
      lastUserMessage: "What should we do next?",
      situationContext: formatPublicSituationContext(situation),
    });
    expect(prompt).toMatch(/MATCHED SITUATION \(allow-listed public fields only\)/);
    expect(prompt).toContain(situation.summary);
    expect(prompt).toContain("phishing-close-call");
    expect(prompt).not.toContain("Alex Chen");
    expect(prompt).not.toContain("123 Main Street");
  });
});
