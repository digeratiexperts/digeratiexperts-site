import { describe, expect, it } from "vitest";
import { AUTO_RENEW_CANCEL_POLICY_TEXT, AUTORENEW_TERMS_VERSION, buildAutoRenewTermsText } from "@shared/autoRenewContract";
import { renderAutoRenewTermsEmailSection } from "./autoRenewEmail";

describe("renderAutoRenewTermsEmailSection", () => {
  it("includes the full auto-renew and cancellation terms in a keepable confirmation block", () => {
    const termsText = buildAutoRenewTermsText({
      priceCents: 3900,
      currency: "USD",
      frequency: "year",
      termMonths: 12,
    });
    const html = renderAutoRenewTermsEmailSection({
      termsVersion: AUTORENEW_TERMS_VERSION,
      termsText,
      cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
      frequency: "year",
      termMonths: 12,
      totalCents: 3900,
      currency: "USD",
      renewsAt: "2027-11-13T00:00:00.000Z",
    });
    expect(html).toContain("Automatic renewal and cancellation terms");
    expect(html).toContain("$39.00");
    expect(html).toContain("yearly");
    expect(html).toContain(AUTORENEW_TERMS_VERSION);
    expect(html).toContain("one click");
    expect(html).toContain("California consumers");
    expect(html).toContain("How to cancel");
    expect(html).not.toContain("<script>");
  });
});
