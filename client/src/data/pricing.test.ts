import { describe, expect, it } from "vitest";
import {
  pricing,
  pricingTiers,
  TECHSALES_ALIGNED,
  enforceMonthlyFloor,
  monthlyForSeats,
  formatUserPrice,
  getPricingFooterText,
} from "./pricing";

describe("canonical ProActive pricing (TechSales-aligned)", () => {
  it("matches Intelligence-Hub CANONICAL_TIERS public floors", () => {
    for (const key of ["it", "office", "business", "enterprise"] as const) {
      expect(pricing[key].user).toBe(TECHSALES_ALIGNED.expected[key].user);
      expect(pricing[key].monthlyMinimum).toBe(
        TECHSALES_ALIGNED.expected[key].monthlyMinimum,
      );
      expect(pricing[key].siteMin).toBe(pricing[key].monthlyMinimum);
    }
  });

  it("exposes all four public tiers in order", () => {
    expect(pricingTiers.map((t) => t.id)).toEqual([
      "it",
      "office",
      "business",
      "enterprise",
    ]);
  });

  it("keeps Office as the sole recommended Store tier", () => {
    expect(pricingTiers.filter((tier) => tier.recommended).map((tier) => tier.id)).toEqual([
      "office",
    ]);
  });

  it("enforces monthly floors", () => {
    expect(monthlyForSeats("office", 5)).toBe(2400); // 5*165=825 < 2400
    expect(monthlyForSeats("office", 20)).toBe(3300); // 20*165
    expect(enforceMonthlyFloor(1000, "it")).toBe(1600);
    expect(enforceMonthlyFloor(20000, "enterprise")).toBe(20000);
  });

  it("formats without stale site-minimum language", () => {
    expect(formatUserPrice("business")).toBe("$245/user/mo");
    expect(getPricingFooterText()).toContain("1,600");
    expect(getPricingFooterText()).toContain("2,400");
    expect(getPricingFooterText()).toContain("5,400");
    expect(getPricingFooterText()).toContain("9,000");
    expect(getPricingFooterText()).not.toMatch(/\$750/);
    expect(getPricingFooterText()).not.toMatch(/\$1,200/);
    expect(getPricingFooterText()).not.toMatch(/\$1,725/);
  });
});
