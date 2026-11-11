import { describe, expect, it } from "vitest";
import { MARKETING_REDIRECTS, marketingRedirectFor } from "./marketingRedirects";
import { isKnownSpaPath } from "./spaKnownPaths";

describe("marketingRedirects", () => {
  it("sends guessed URLs to the real pages", () => {
    expect(marketingRedirectFor("/about")).toBe("/about/mission-values");
    expect(marketingRedirectFor("/About/")).toBe("/about/mission-values");
    expect(marketingRedirectFor("/services")).toBe("/solutions");
  });

  it("folds the duplicate pricing URL into the canonical /pricing", () => {
    expect(marketingRedirectFor("/proactive-ecosystem-pricing")).toBe("/pricing");
    // The service matrix is a different page and is not redirected.
    expect(marketingRedirectFor("/ecosystem-pricing")).toBeUndefined();
    expect(marketingRedirectFor("/pricing")).toBeUndefined();
  });

  it("leaves nested paths alone", () => {
    expect(marketingRedirectFor("/about/team")).toBeUndefined();
    expect(marketingRedirectFor("/services/ucaas")).toBeUndefined();
  });

  it("only targets pages the server serves with 200", () => {
    for (const target of Object.values(MARKETING_REDIRECTS)) {
      expect(isKnownSpaPath(target), target).toBe(true);
    }
  });
});
