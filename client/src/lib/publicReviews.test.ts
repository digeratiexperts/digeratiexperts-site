import { describe, expect, it } from "vitest";
import { summarizeReviews } from "./publicReviews";

const review = {
  id: "g1",
  source: "google" as const,
  sourceLabel: "Google",
  origin: "live" as const,
  authorName: "A. Client",
  rating: 5,
  text: "Verbatim text",
};

describe("summarizeReviews", () => {
  it("is empty when the feed is empty (the UI then renders nothing)", () => {
    const s = summarizeReviews({ reviews: [], google: { status: "unconfigured", rating: null, userRatingsTotal: null } });
    expect(s.hasReviews).toBe(false);
    expect(s.googleRating).toBeNull();
  });

  it("shows Google's own rating only when Places returned one", () => {
    const s = summarizeReviews({
      reviews: [review],
      google: { status: "ok", rating: 4.86, userRatingsTotal: 23, mapsUri: "https://maps.google.com/?cid=1" },
    });
    expect(s.googleRating).toEqual({ rating: 4.9, count: 23, href: "https://maps.google.com/?cid=1" });
  });

  it("never builds a rating from curated catalog reviews", () => {
    const s = summarizeReviews({ reviews: [{ ...review, origin: "catalog" }], google: { status: "error", rating: null } });
    expect(s.hasReviews).toBe(true);
    expect(s.googleRating).toBeNull();
  });

  it("drops entries without an author or text", () => {
    const s = summarizeReviews({ reviews: [{ ...review, text: " " }, { ...review, authorName: "" }] });
    expect(s.hasReviews).toBe(false);
  });

  it("ignores a zero-count or out-of-range rating", () => {
    expect(summarizeReviews({ google: { status: "ok", rating: 5, userRatingsTotal: 0 } }).googleRating).toBeNull();
    expect(summarizeReviews({ google: { status: "ok", rating: 7, userRatingsTotal: 3 } }).googleRating).toBeNull();
  });
});
