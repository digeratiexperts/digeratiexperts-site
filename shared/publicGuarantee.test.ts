import { describe, expect, it } from "vitest";
import {
  GUARANTEE_AGREEMENT_CONTROLS,
  GUARANTEE_MSA_HREF,
  GUARANTEE_MSA_LINK_TEXT,
  GUARANTEE_HOW_IT_WORKS,
  GUARANTEE_INTRO,
  GUARANTEE_MENU_LABEL,
  GUARANTEE_ONBOARDING_FEE_CLAUSE,
  GUARANTEE_SHORT,
  GUARANTEE_SHORT_FEE_LABEL,
  GUARANTEE_TITLE,
  GUARANTEE_WHATS_COVERED,
  GUARANTEE_WHATS_NOT_COVERED,
} from "./publicGuarantee";

describe("public guarantee wording", () => {
  it("keeps Legal's short sentence and swap points in one place", () => {
    expect(GUARANTEE_MENU_LABEL).toBe("30-Day Guarantee");
    expect(GUARANTEE_SHORT_FEE_LABEL).toBe("managed-service fees");
    expect(GUARANTEE_ONBOARDING_FEE_CLAUSE).toBe(
      ", including our onboarding or setup fees for those services,",
    );
    expect(GUARANTEE_SHORT).toBe(
      "30-day money-back guarantee on managed services: if you're not satisfied, tell us in writing within 30 days of your start date and we'll refund 100% of your managed-service fees for that period, no questions asked. Hardware, kits, and third-party licenses are not covered.",
    );
  });

  it("keeps Legal's page body", () => {
    expect(GUARANTEE_TITLE).toBe("Our 30-Day Money-Back Guarantee");
    expect(GUARANTEE_INTRO).toContain("first 30 days");
    expect(GUARANTEE_HOW_IT_WORKS).toContain("admin@digeratiexperts.com");
    expect(GUARANTEE_HOW_IT_WORKS).toContain(GUARANTEE_ONBOARDING_FEE_CLAUSE);
    expect(GUARANTEE_WHATS_COVERED).toContain("ProActive IT, Office, or Business");
    expect(GUARANTEE_WHATS_NOT_COVERED).toContain("hardware, kits, and other DE Store purchases");
    expect(GUARANTEE_MSA_LINK_TEXT).toBe("Master Services Agreement, Section 6.5");
    expect(GUARANTEE_MSA_HREF).toBe("/legal/msa");
    expect(GUARANTEE_AGREEMENT_CONTROLS).toBe(
      "The full terms are in our Master Services Agreement, Section 6.5. If this page and your signed agreement differ, your signed agreement governs.",
    );
  });
});
