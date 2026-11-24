import { describe, expect, it } from "vitest";
import {
  EXIT_POPUP_DISMISSED_KEY,
  SCRATCH_OFFER_STORAGE_KEY,
  SITE_POPUP_COOKIE,
  SITE_POPUP_STORAGE_KEY,
  canAutoShowGoalPicker,
  claimSitePopup,
  isPromoPopupPath,
  parseSitePopup,
  readSitePopup,
  scratchOfferConsumed,
  sitePopupCookieString,
} from "./sitePopup";

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    data,
  };
}

describe("isPromoPopupPath", () => {
  it("allows marketing pages", () => {
    for (const path of ["/", "/solutions", "/resources/blog/some-post", "/industries/healthcare"]) {
      expect(isPromoPopupPath(path)).toBe(true);
    }
  });

  it("stays off the portal, store, checkout, order, desk and form pages", () => {
    for (const path of [
      "/portal",
      "/portal/chat",
      "/store",
      "/store/checkout",
      "/store/order/123",
      "/checkout",
      "/contact",
      "/book",
      "/assessment",
      "/describe-your-situation",
      "/signup",
      "/support/submit-ticket",
      "/legal/privacy-policy",
      "/support",
    ]) {
      expect(isPromoPopupPath(path)).toBe(false);
    }
  });

  it("stays off the portal host", () => {
    expect(isPromoPopupPath("/", "portal.digeratiexperts.com")).toBe(false);
  });
});

describe("shared popup slot", () => {
  it("parses a stored claim and a bare cookie value", () => {
    expect(parseSitePopup(JSON.stringify({ id: "goal", at: 10 }))).toEqual({ id: "goal", at: 10 });
    expect(parseSitePopup("scratch")).toEqual({ id: "scratch", at: 0 });
    expect(parseSitePopup("{not json")).toBeNull();
    expect(parseSitePopup(null)).toBeNull();
  });

  it("reads the cookie when localStorage is empty", () => {
    expect(readSitePopup(memory(), `${SITE_POPUP_COOKIE}=goal`)).toEqual({ id: "goal", at: 0 });
  });

  it("writes a SameSite cookie", () => {
    expect(sitePopupCookieString("goal")).toContain(`${SITE_POPUP_COOKIE}=goal`);
    expect(sitePopupCookieString("goal")).toContain("SameSite=Lax");
  });

  it("treats a used scratch-card state as consumed", () => {
    expect(scratchOfferConsumed(memory())).toBe(false);
    expect(scratchOfferConsumed(memory({ [SCRATCH_OFFER_STORAGE_KEY]: JSON.stringify({ step: "scratch" }) }))).toBe(false);
    expect(scratchOfferConsumed(memory({ [SCRATCH_OFFER_STORAGE_KEY]: JSON.stringify({ dismissedAt: 1 }) }))).toBe(true);
    expect(scratchOfferConsumed(memory({ [SCRATCH_OFFER_STORAGE_KEY]: JSON.stringify({ claimCode: "SNAP-ACDE-FG34" }) }))).toBe(true);
    expect(scratchOfferConsumed(memory({ [SCRATCH_OFFER_STORAGE_KEY]: "not-json" }))).toBe(false);
  });

  it("auto-shows only when no other popup has claimed the visitor", () => {
    expect(canAutoShowGoalPicker({ storage: memory(), session: memory() })).toBe(true);
    expect(
      canAutoShowGoalPicker({
        storage: memory({ [SITE_POPUP_STORAGE_KEY]: JSON.stringify({ id: "scratch", at: 1 }) }),
        session: memory(),
      }),
    ).toBe(false);
    expect(
      canAutoShowGoalPicker({
        storage: memory({ [SITE_POPUP_STORAGE_KEY]: JSON.stringify({ id: "goal", at: 1 }) }),
        session: memory(),
      }),
    ).toBe(false);
    expect(
      canAutoShowGoalPicker({
        storage: memory({ [SCRATCH_OFFER_STORAGE_KEY]: JSON.stringify({ dismissedAt: 1 }) }),
        session: memory(),
      }),
    ).toBe(false);
    expect(
      canAutoShowGoalPicker({
        storage: memory(),
        session: memory({ [EXIT_POPUP_DISMISSED_KEY]: "true" }),
      }),
    ).toBe(false);
    const doc = {
      documentElement: { hasAttribute: (name: string) => name === "data-de-desk-open" },
      querySelector: () => null,
    };
    expect(canAutoShowGoalPicker({ storage: memory(), session: memory(), document: doc as never })).toBe(false);
  });

  it("will not claim the slot for the goal picker after the scratch offer has run", () => {
    const storage = memory({ [SCRATCH_OFFER_STORAGE_KEY]: JSON.stringify({ dismissedAt: 9 }) });
    expect(claimSitePopup("goal", storage, 100)).toBe(false);
    expect(readSitePopup(storage)).toBeNull();
  });

  it("claims once and refuses a second offer", () => {
    const storage = memory();
    expect(claimSitePopup("goal", storage, 10)).toBe(true);
    expect(claimSitePopup("scratch", storage, 11)).toBe(false);
    expect(readSitePopup(storage)?.id).toBe("goal");
    expect(claimSitePopup("goal", storage, 12)).toBe(true);
  });
});
