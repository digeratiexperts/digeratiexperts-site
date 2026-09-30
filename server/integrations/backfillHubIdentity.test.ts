import { describe, expect, it } from "vitest";
import { retainHubAccountMapping, selectBackfillUpdates, trustedHubAccountId } from "./backfillHubIdentity";

describe("portal hub account backfill", () => {
  it("accepts only a stored positive integer Hub id", () => {
    expect(trustedHubAccountId("41")).toBe("41");
    expect(trustedHubAccountId("Northwind")).toBeNull();
    expect(trustedHubAccountId("0")).toBeNull();
  });

  it("fills an empty portal client and leaves a mapped client alone", () => {
    expect(
      selectBackfillUpdates([
        { clientId: "a", hubAccountId: null, externalId: "41" },
        { clientId: "b", hubAccountId: "9", externalId: "10" },
        { clientId: "c", hubAccountId: null, externalId: "Acme" },
      ]),
    ).toEqual([{ clientId: "a", hubAccountId: "41" }]);
  });

  it("refuses a different Hub id, a renamed company, and an email-shaped value", () => {
    expect(retainHubAccountMapping(null, "41")).toEqual({ action: "set", hubAccountId: "41" });
    expect(retainHubAccountMapping("41", "41")).toEqual({ action: "keep", hubAccountId: "41" });
    expect(retainHubAccountMapping("41", "12")).toEqual({
      action: "conflict",
      existing: "41",
      incoming: "12",
    });
    expect(retainHubAccountMapping("41", "Acme Dental")).toEqual({ action: "ignore" });
    expect(retainHubAccountMapping("41", "ada@example.com")).toEqual({ action: "ignore" });
  });
});
