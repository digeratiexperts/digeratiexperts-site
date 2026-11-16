import { describe, expect, it } from "vitest";
import {
  CLAIM_CODE_ALPHABET,
  SCRATCH_OFFER_TERMS,
  isExcludedState,
  buildClaimCode,
  normalizeClaimCode,
  validateClaimFields,
} from "./scratchOffer";

describe("claim codes", () => {
  it("uses only the unambiguous alphabet in SNAP-XXXX-XXXX form", () => {
    let n = 0;
    const code = buildClaimCode((max) => n++ % max);
    expect(code).toMatch(/^SNAP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    for (const ch of code.slice(5).replace("-", "")) expect(CLAIM_CODE_ALPHABET).toContain(ch);
  });

  it("leaves out look-alike characters", () => {
    for (const ch of "0OQ1IL2Z5S8BV") expect(CLAIM_CODE_ALPHABET).not.toContain(ch);
  });

  it("normalizes case and rejects anything off-format", () => {
    expect(normalizeClaimCode(" snap-acde-fg34 ")).toBe("SNAP-ACDE-FG34");
    expect(normalizeClaimCode("SNAP-AC0E-FG34")).toBeNull();
    expect(normalizeClaimCode("SNAP-ACDE")).toBeNull();
    expect(normalizeClaimCode("<script>")).toBeNull();
    expect(normalizeClaimCode(42)).toBeNull();
  });
});

describe("validateClaimFields", () => {
  it("requires a work email and a business name", () => {
    expect(validateClaimFields({})).toEqual({
      email: "Enter your work email.",
      company: "Enter your business name.",
      state: "Choose your business's state.",
    });
  });

  it("turns away personal inboxes and malformed addresses", () => {
    expect(validateClaimFields({ email: "a@gmail.com", company: "Acme", state: "AZ" }).email).toMatch(/work email/);
    expect(validateClaimFields({ email: "not-an-email", company: "Acme", state: "AZ" }).email).toMatch(/valid/);
  });

  it("accepts a business address", () => {
    expect(validateClaimFields({ email: "ops@acme.co", company: "Acme Dental", state: "az" })).toEqual({});
  });

  it("turns away excluded and unknown states", () => {
    for (const state of ["CA", "NY", "MA", "HI"]) {
      expect(isExcludedState(state)).toBe(true);
      expect(validateClaimFields({ email: "ops@acme.co", company: "Acme", state }).state).toBe(
        "This offer isn't available in your state yet.",
      );
    }
    expect(validateClaimFields({ email: "ops@acme.co", company: "Acme", state: "ZZ" }).state).toMatch(/Choose/);
  });
});

describe("offer terms", () => {
  it("publishes no dollar amount or former price", () => {
    const visible = Object.entries(SCRATCH_OFFER_TERMS)
      .filter(([key, value]) => typeof value === "string" && key !== "creditTerms")
      .map(([, value]) => value)
      .join(" ");
    expect(visible).not.toMatch(/\$\s*\d/);
    expect(visible.toLowerCase()).not.toContain("normally");
    expect(visible.toLowerCase()).not.toContain("value");
  });

  it("names no store-purchase credit", () => {
    expect(SCRATCH_OFFER_TERMS.creditTerms.toLowerCase()).not.toContain("store");
  });
});
