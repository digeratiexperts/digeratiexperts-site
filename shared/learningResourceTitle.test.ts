import { describe, expect, it } from "vitest";
import {
  learningResourceTitle,
  naiveLearningResourceTitle,
  presentLearningResourceTitle,
} from "./learningResourceTitle";

describe("learning resource fallback titles", () => {
  it("keeps curriculum acronyms when the slug is title-cased", () => {
    expect(learningResourceTitle("sow-bdr")).toBe("SOW BDR");
    expect(learningResourceTitle("sow-vcio-strategic")).toBe("SOW vCIO Strategic");
    expect(learningResourceTitle("sow-csra")).toBe("SOW CSRA");
    expect(learningResourceTitle("sow-security-stack")).toBe("SOW Security Stack");
    expect(learningResourceTitle("sow-compliance-risk-ops")).toBe("SOW Compliance Risk Ops");
    expect(learningResourceTitle("sow-core-it")).toBe("SOW Core IT");
    expect(learningResourceTitle("sow-ucaas-voip")).toBe("SOW UCaaS VoIP");
    expect(learningResourceTitle("proactive-it-tier-bridge")).toBe("ProActive IT Tier Bridge");
    expect(learningResourceTitle("proactive-ecosystem-overview")).toBe("ProActive Ecosystem Overview");
    expect(learningResourceTitle("onboarding-checklist")).toBe("Onboarding Checklist");
  });

  it("replaces only the disconnected mechanical fallback", () => {
    const slug = "sow-bdr";
    expect(presentLearningResourceTitle(slug, naiveLearningResourceTitle(slug), "none")).toBe("SOW BDR");
    expect(presentLearningResourceTitle(slug, naiveLearningResourceTitle(slug), "unconfigured")).toBe("SOW BDR");
    expect(presentLearningResourceTitle(slug, "SOW — Backup and recovery", "techsales")).toBe(
      "SOW — Backup and recovery",
    );
    expect(presentLearningResourceTitle(slug, "Backup coverage note", "none")).toBe("Backup coverage note");
    expect(presentLearningResourceTitle(slug, "", "none")).toBe("SOW BDR");
  });
});
