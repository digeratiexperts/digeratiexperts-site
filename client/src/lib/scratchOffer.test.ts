import { describe, expect, it } from "vitest";
import {
  DISMISS_COOLDOWN_MS,
  autoShowDecision,
  bookingHrefForClaim,
  clearedFraction,
  isScratchOfferPath,
  parseScratchState,
  sampleGridSize,
  scratchOfferEnabled,
  scratchPreviewRequest,
} from "./scratchOffer";

function alphaBuffer(alphas: number[]): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(alphas.length * 4);
  alphas.forEach((a, i) => {
    buf[i * 4 + 3] = a;
  });
  return buf;
}

describe("clearedFraction", () => {
  it("counts pixels scratched below half alpha", () => {
    expect(clearedFraction(alphaBuffer([255, 255, 255, 255]))).toBe(0);
    expect(clearedFraction(alphaBuffer([0, 0, 255, 255]))).toBe(0.5);
    expect(clearedFraction(alphaBuffer([127, 128, 0, 0]))).toBe(0.75);
    expect(clearedFraction(new Uint8ClampedArray(0))).toBe(0);
  });

  it("crosses the reveal threshold at 55%", () => {
    const alphas = Array.from({ length: 100 }, (_, i) => (i < 55 ? 0 : 255));
    expect(clearedFraction(alphaBuffer(alphas))).toBeGreaterThanOrEqual(0.55);
  });
});

describe("sampleGridSize", () => {
  it("keeps the card's aspect ratio near the cell budget", () => {
    const { cols, rows } = sampleGridSize(340, 200);
    expect(cols * rows).toBeGreaterThan(1200);
    expect(cols * rows).toBeLessThan(2000);
    expect(cols / rows).toBeCloseTo(1.7, 0);
    expect(sampleGridSize(0, 100)).toEqual({ cols: 1, rows: 1 });
  });
});

describe("flag gating", () => {
  it("is off unless the flag is set", () => {
    expect(scratchOfferEnabled({})).toBe(false);
    expect(scratchOfferEnabled({ VITE_SCRATCH_OFFER: "0" })).toBe(false);
    expect(scratchOfferEnabled({ VITE_SCRATCH_OFFER: "1" })).toBe(true);
    expect(scratchOfferEnabled({ VITE_SCRATCH_OFFER: "true" })).toBe(true);
  });

  it("ignores the preview query in a production build with the flag off", () => {
    expect(scratchPreviewRequest("?scratch=1", { DEV: false })).toBeNull();
    expect(scratchPreviewRequest("?scratch=1", { DEV: true })).toBe("open");
    expect(scratchPreviewRequest("?scratch=reset", { VITE_SCRATCH_OFFER: "1" })).toBe("reset");
    expect(scratchPreviewRequest("?scratch=yes", { DEV: true })).toBeNull();
  });
});

describe("isScratchOfferPath", () => {
  it("allows marketing pages", () => {
    for (const path of ["/", "/solutions", "/resources/blog/some-post", "/industries/healthcare"]) {
      expect(isScratchOfferPath(path)).toBe(true);
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
      "/solutions/request",
      "/legal/privacy-policy",
    ]) {
      expect(isScratchOfferPath(path)).toBe(false);
    }
  });

  it("stays off the portal host", () => {
    expect(isScratchOfferPath("/", "portal.digeratiexperts.com")).toBe(false);
  });
});

describe("scratch state", () => {
  it("restores the code screen when a code is saved", () => {
    expect(parseScratchState(JSON.stringify({ step: "revealed", claimCode: "SNAP-ACDE-FG34" }))).toMatchObject({
      step: "code",
      claimCode: "SNAP-ACDE-FG34",
    });
  });

  it("drops a tampered code and falls back", () => {
    expect(parseScratchState(JSON.stringify({ step: "code", claimCode: "<b>" }))).toEqual({ step: "details" });
    expect(parseScratchState("{not json")).toEqual({ step: "scratch" });
  });

  it("caps how often the card shows", () => {
    const now = 1_000_000_000_000;
    expect(autoShowDecision({ step: "scratch" }, now)).toBe("show");
    expect(autoShowDecision({ step: "scratch", dismissedAt: now - 1000 }, now)).toBe("skip");
    expect(autoShowDecision({ step: "scratch", dismissedAt: now - DISMISS_COOLDOWN_MS - 1 }, now)).toBe("show");
    expect(autoShowDecision({ step: "revealed" }, now)).toBe("skip");
    expect(autoShowDecision({ step: "code", claimCode: "SNAP-ACDE-FG34" }, now)).toBe("skip");
    expect(autoShowDecision({ step: "details", open: true }, now)).toBe("resume");
  });
});

it("carries the claim code to the booking page", () => {
  expect(bookingHrefForClaim("SNAP-ACDE-FG34")).toBe("/book?claim=SNAP-ACDE-FG34");
});
