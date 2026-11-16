import { describe, expect, it } from "vitest";
import {
  isScratchOfferClaim,
  parseScratchClaim,
  scratchClaimNote,
  scratchOfferServerEnabled,
} from "./scratchOfferIntake";

describe("scratchOfferServerEnabled", () => {
  it("is off in production unless the flag is set", () => {
    expect(scratchOfferServerEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(scratchOfferServerEnabled({ NODE_ENV: "production", SCRATCH_OFFER_ENABLED: "1" })).toBe(true);
    expect(scratchOfferServerEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("parseScratchClaim", () => {
  const body = { offer: "security-snapshot-scratch", email: "ops@acme.co", company: "Acme Dental", state: "AZ" };

  it("recognises the offer tag only", () => {
    expect(isScratchOfferClaim(body)).toBe(true);
    expect(isScratchOfferClaim({ offer: "other" })).toBe(false);
    expect(isScratchOfferClaim(null)).toBe(false);
  });

  it("refuses when the offer is switched off", () => {
    expect(parseScratchClaim(body, { enabled: false })).toMatchObject({ ok: false, status: 404 });
  });

  it("returns field errors for missing details", () => {
    const result = parseScratchClaim({ offer: body.offer }, { enabled: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fields ?? {})).toEqual(["email", "company", "state"]);
  });

  it("issues no code for an excluded state", () => {
    for (const state of ["CA", "ny", "MA", "HI"]) {
      const result = parseScratchClaim({ ...body, state }, { enabled: true });
      expect(result).toMatchObject({ ok: false, status: 403, code: "state_excluded" });
      expect("claim" in result).toBe(false);
    }
  });

  it("issues a server-side code and keeps marketing opt-in off unless sent as true", () => {
    const result = parseScratchClaim({ ...body, marketingOptIn: "true" }, { enabled: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim.claimCode).toMatch(/^SNAP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(result.claim.marketingOptIn).toBe(false);
    expect(scratchClaimNote(result.claim)).toContain(result.claim.claimCode);
    expect(scratchClaimNote(result.claim)).toContain("Marketing email opt-in: no");
  });

  it("does not repeat codes across claims", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const result = parseScratchClaim(body, { enabled: true });
      if (result.ok) codes.add(result.claim.claimCode);
    }
    expect(codes.size).toBe(500);
  });
});
