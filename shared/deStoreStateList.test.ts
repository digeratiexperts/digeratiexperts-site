import { describe, expect, it } from "vitest";
import type { PostalAddress } from "./deStoreContract";
import { evaluateSiteStateList, parseRegionList } from "./deStoreStateList";

const az: PostalAddress = {
  street1: "1 N Arizona Ave",
  city: "Chandler",
  region: "AZ",
  postalCode: "85225",
  country: "US",
};

const ny: PostalAddress = { ...az, region: "ny", city: "New York", postalCode: "10001" };
const tx: PostalAddress = { ...az, region: "TX", city: "Austin", postalCode: "78701" };

describe("site state list", () => {
  it("parses codes case-insensitively and rejects invalid codes without changing the list", () => {
    expect(parseRegionList(" ny, Az ")).toEqual({ ok: true, regions: ["NY", "AZ"] });
    expect(parseRegionList("NY, ZZ").ok).toBe(false);
  });

  it("does not enforce when the flag is off, even if regions are set", () => {
    const result = evaluateSiteStateList(
      { billTo: ny, shipTo: az },
      { enabled: false, mode: "deny", regions: ["NY"] },
    );
    expect(result.blocked).toBe(false);
  });

  it("blocks billing or shipping addresses on a deny list and uses the legal message", () => {
    const result = evaluateSiteStateList(
      { billTo: ny, shipTo: az },
      { enabled: true, mode: "deny", regions: ["NY"] },
    );
    expect(result.blocked).toBe(true);
    expect(result.regions).toEqual(["NY"]);
    expect(result.fields).toEqual(["billTo"]);
    expect(result.message).toContain("New York");
    expect(result.message).toContain("You have not been charged");
    expect(result.message).toContain("admin@digeratiexperts.com");
  });

  it("in allow mode, blocks addresses outside the list", () => {
    const result = evaluateSiteStateList(
      { billTo: az, shipTo: tx },
      { enabled: true, mode: "allow", regions: ["AZ"] },
    );
    expect(result.blocked).toBe(true);
    expect(result.regions).toEqual(["TX"]);
    expect(result.fields).toEqual(["shipTo"]);
  });
});
