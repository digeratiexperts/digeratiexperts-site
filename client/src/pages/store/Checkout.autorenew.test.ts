import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "Checkout.tsx"), "utf8");

describe("Staff checkout auto-renew wiring", () => {
  it("shows AutoRenewTerms and never pre-checks consent", () => {
    expect(source).toContain("AutoRenewTerms");
    expect(source).toContain("autoRenewConsentChecked");
    expect(source).toMatch(/useState\(false\)/);
    expect(source).not.toMatch(/setAutoRenewConsentChecked\(\s*true\s*\)/);
    expect(source).toContain("AUTORENEW_SUBSCRIPTION_REQUIRED");
    expect(source).toContain("/api/store/subscriptions");
  });

  it("routes gated SKUs to a quote when the contract flag is off", () => {
    expect(source).toContain("loadAutoRenewContractEnabled");
    expect(source).toContain("quote_request");
    expect(source).toContain("autoRenewEnabled");
  });
});
