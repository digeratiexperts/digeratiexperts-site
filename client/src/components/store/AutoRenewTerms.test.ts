import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTO_RENEW_CHECKBOX_LABEL_TEXT, buildConsentSnapshot } from "./AutoRenewTerms";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "AutoRenewTerms.tsx"), "utf8");

describe("AutoRenewTerms", () => {
  it("keeps the consent checkbox unchecked by default and never pre-checks it", () => {
    expect(source).toContain('checked={checked}');
    expect(source).not.toMatch(/checked=\{\s*true\s*\}/);
    expect(source).not.toMatch(/defaultChecked/);
    expect(source).toContain('AUTO_RENEW_CHECKBOX_LABEL_TEXT');
    expect(source).toContain('unchecked-by-default');
    expect(source).toContain('start it as false');
    expect(AUTO_RENEW_CHECKBOX_LABEL_TEXT.toLowerCase()).toContain('automatic renewal');
  });

  it("builds a consent snapshot that includes price, frequency and the cancel method", () => {
    const consent = buildConsentSnapshot({
      priceCents: 2400,
      currency: "USD",
      frequency: "year",
      termMonths: 12,
      pageUrl: "https://digeratiexperts.com/internal/warehouse/checkout",
      consentedAt: "2026-11-13T16:00:00.000Z",
    });
    expect(consent.autoRenewConsentAt).toBe("2026-11-13T16:00:00.000Z");
    expect(consent.termsTextSnapshot).toContain("$24.00");
    expect(consent.termsTextSnapshot.toLowerCase()).toContain("yearly");
    expect(consent.cancelPolicyText.toLowerCase()).toContain("one click");
    expect(consent.checkboxLabelText).toBe(AUTO_RENEW_CHECKBOX_LABEL_TEXT);
  });
});
