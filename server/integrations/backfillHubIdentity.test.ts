import { describe, expect, it } from "vitest";
import { selectBackfillUpdates, trustedHubAccountId } from "./backfillHubIdentity";

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
});
