import { describe, expect, it } from "vitest";
import { deskOpenSeed } from "./deskOpenSeed";
import { STORE_ADVISOR_SEED } from "./openMspAdvisor";

describe("Desk open seed", () => {
  it("keeps an explicit seed", () => {
    expect(deskOpenSeed({ seedMessage: "My printer is down" }, "/store")).toBe("My printer is down");
  });

  it("seeds the store advisor on every Door 2 page", () => {
    for (const path of [
      "/store",
      "/store/",
      "/store/checkout",
      "/store/solution",
      "/store/solutions/security",
      "/store/solution/submitted/DE-123",
      "/solutions/request",
      "/solutions/request/thanks",
      "/solutions/business-needs",
    ]) {
      expect(deskOpenSeed({}, path), path).toBe(STORE_ADVISOR_SEED);
    }
  });

  it("seeds the store advisor when the caller says it is a store open", () => {
    expect(deskOpenSeed({ context: "store" }, "/pricing")).toBe(STORE_ADVISOR_SEED);
  });

  it("leaves other pages unseeded, including paths that merely contain /store", () => {
    expect(deskOpenSeed({}, "/")).toBeUndefined();
    expect(deskOpenSeed({}, "/pricing")).toBeUndefined();
    expect(deskOpenSeed({}, "/resources/storefront-security")).toBeUndefined();
    expect(deskOpenSeed({ context: "home" }, "/")).toBeUndefined();
  });
});
