import { describe, expect, it } from "vitest";
import { describeQuoteContext, quoteLeadDescription, sanitizeQuoteContext } from "./quoteContext";

describe("quote wizard context answers", () => {
  it("keeps known ids and drops everything else", () => {
    expect(
      sanitizeQuoteContext({
        itToday: "provider",
        trigger: "insurance",
        frameworks: ["hipaa", "pci", "<script>", 7],
        extra: "ignored",
      }),
    ).toEqual({ itToday: "provider", trigger: "insurance", frameworks: ["hipaa", "pci"] });
  });

  it("returns undefined for a missing, empty or malformed payload", () => {
    for (const raw of [undefined, null, "provider", [], {}, { itToday: "nope", frameworks: "hipaa" }]) {
      expect(sanitizeQuoteContext(raw)).toBeUndefined();
    }
  });

  it("drops 'Not that I know of' when a framework was also picked, and dedupes", () => {
    expect(sanitizeQuoteContext({ frameworks: ["none", "cmmc", "cmmc"] })).toEqual({ frameworks: ["cmmc"] });
    expect(sanitizeQuoteContext({ frameworks: ["none"] })).toEqual({ frameworks: ["none"] });
  });

  it("describes the context with labels only, for the CRM", () => {
    expect(describeQuoteContext({ itToday: "one-person", trigger: "incident", frameworks: ["hipaa", "ftc-safeguards"] })).toBe(
      "IT today: One person in-house; Looking now because: Something went wrong; Rules they follow: HIPAA, FTC Safeguards",
    );
    expect(describeQuoteContext(undefined)).toBe("");
  });
});

describe("quote lead CRM description", () => {
  it("is byte-identical to the pre-quiz description when no context was given", () => {
    expect(quoteLeadDescription({ recommendedPlan: "Office", seats: 5, connectivity: "no", devices: "no" })).toBe(
      "Quote Wizard: Recommended Plan: Office, Seats: 5, Connectivity: no, Devices: no",
    );
  });

  it("appends the sanitized context answers", () => {
    const context = sanitizeQuoteContext({ itToday: "provider", trigger: "insurance", frameworks: ["hipaa", "bogus"] });
    expect(quoteLeadDescription({ recommendedPlan: "Business", seats: 20, connectivity: "yes", devices: "yes", context })).toBe(
      "Quote Wizard: Recommended Plan: Business, Seats: 20, Connectivity: yes, Devices: yes. IT today: Another IT provider; Looking now because: Insurance renewal or questionnaire; Rules they follow: HIPAA",
    );
  });
});
