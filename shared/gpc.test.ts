import { describe, expect, it } from "vitest";
import { headerSignalsGpc, marketingAllowedByConsent, navigatorSignalsGpc } from "./gpc";

describe("Global Privacy Control", () => {
  it("reads the Sec-GPC header and navigator.globalPrivacyControl flag", () => {
    expect(headerSignalsGpc("1")).toBe(true);
    expect(headerSignalsGpc(["1"])).toBe(true);
    expect(headerSignalsGpc("0")).toBe(false);
    expect(headerSignalsGpc(undefined)).toBe(false);
    expect(navigatorSignalsGpc(true)).toBe(true);
    expect(navigatorSignalsGpc(1)).toBe(true);
    expect(navigatorSignalsGpc(false)).toBe(false);
  });

  it("treats GPC as an opt-out of sale or share even after a marketing grant", () => {
    expect(marketingAllowedByConsent(true, true)).toBe(false);
    expect(marketingAllowedByConsent(true, false)).toBe(true);
    expect(marketingAllowedByConsent(false, false)).toBe(false);
  });
});
