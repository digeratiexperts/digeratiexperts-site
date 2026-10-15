import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPAIGNS, campaignBySlug } from "./campaigns";
import { EXECUTIVE_BRIEFS } from "./executiveBriefs";
import { resourceBySlug, resources } from "./resourceRegistry";

const STANDALONE = /\bDigerati\b(?! Experts)/;

describe("campaign landing catalog", () => {
  it("publishes the nine conversion offers", () => {
    expect(CAMPAIGNS.map((campaign) => campaign.slug)).toEqual([
      "cyber-risk-assessment",
      "managed-it",
      "ransomware-readiness",
      "co-managed-it",
      "healthcare-it",
      "cyber-insurance",
      "email-security",
      "proactive-business",
      "ai-background-check",
    ]);
  });

  it("uses Digerati Experts or DE, never standalone Digerati", () => {
    const blob = JSON.stringify(CAMPAIGNS);
    expect(STANDALONE.test(blob)).toBe(false);
  });

  it("points related assets and briefs at real slugs", () => {
    for (const campaign of CAMPAIGNS) {
      if (campaign.relatedAssetSlug) {
        expect(resourceBySlug(campaign.relatedAssetSlug), campaign.relatedAssetSlug).toBeTruthy();
      }
      if (campaign.relatedBriefSlug) {
        expect(
          EXECUTIVE_BRIEFS.some((brief) => brief.slug === campaign.relatedBriefSlug),
          campaign.relatedBriefSlug,
        ).toBe(true);
      }
      expect(campaign.deeperHref.startsWith("/")).toBe(true);
      expect(campaign.deeperHref).not.toBe("/book");
    }
    expect(campaignBySlug("cyber-risk-assessment")?.pricingNote).toMatch(/2,500|2500/);
    expect(campaignBySlug("ai-background-check")?.cta?.label).toMatch(/AI Background Check/);
  });
});

describe("shipped resource PDFs", () => {
  it("has a file on disk for every registry resource", () => {
    const publicRoot = join(import.meta.dirname, "../../public");
    for (const resource of resources) {
      expect(existsSync(join(publicRoot, resource.file)), resource.file).toBe(true);
    }
  });
});

describe("executive briefs", () => {
  it("stays on published DE positions", () => {
    const blob = JSON.stringify(EXECUTIVE_BRIEFS);
    expect(STANDALONE.test(blob)).toBe(false);
    expect(blob.toLowerCase()).not.toContain("guarantees coverage");
    for (const brief of EXECUTIVE_BRIEFS) {
      if (brief.relatedAssetSlug) {
        expect(resourceBySlug(brief.relatedAssetSlug)).toBeTruthy();
      }
    }
  });
});
