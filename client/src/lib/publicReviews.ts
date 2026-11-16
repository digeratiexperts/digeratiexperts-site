import { useEffect, useState } from "react";
import type { PublicReviewItem } from "@/data/reviewsCatalog";

/**
 * Real-review summary for the homepage proof (MSP website research, 2026-11-11).
 *
 * Reads GET /api/public/reviews (server/reviews.ts: live Google Places when
 * GOOGLE_PLACE_ID is valid, optional Yelp, plus verbatim pastes in reviewsCatalog.ts).
 * Rules this enforces, from .cursorrules section 3 and docs/GOOGLE-REVIEWS.md:
 * - The star rating and count are shown only when Google itself returns them. We never
 *   average our own curated pastes into a "rating": a hand-picked set is not a rating.
 * - No reviews, no section. Every consumer renders nothing when `hasReviews` is false.
 */

export type ReviewsPayloadLike = {
  reviews?: PublicReviewItem[];
  mapsUri?: string;
  google?: { status?: string; rating?: number | null; userRatingsTotal?: number | null; mapsUri?: string | null };
};

export type ReviewSummary = {
  hasReviews: boolean;
  reviews: PublicReviewItem[];
  /** Google's own aggregate, only when Places answered with one. */
  googleRating: { rating: number; count: number; href: string } | null;
};

export const EMPTY_REVIEW_SUMMARY: ReviewSummary = { hasReviews: false, reviews: [], googleRating: null };

export function summarizeReviews(payload: ReviewsPayloadLike | null | undefined): ReviewSummary {
  if (!payload) return EMPTY_REVIEW_SUMMARY;
  const reviews = (payload.reviews ?? []).filter(
    (r) => r && typeof r.text === "string" && r.text.trim() && typeof r.authorName === "string" && r.authorName.trim(),
  );
  const g = payload.google;
  const rating = typeof g?.rating === "number" && Number.isFinite(g.rating) ? g.rating : null;
  const count = typeof g?.userRatingsTotal === "number" ? g.userRatingsTotal : 0;
  const googleRating =
    g?.status === "ok" && rating !== null && rating > 0 && rating <= 5 && count > 0
      ? { rating: Math.round(rating * 10) / 10, count, href: g.mapsUri || payload.mapsUri || "" }
      : null;
  return { hasReviews: reviews.length > 0 || googleRating !== null, reviews, googleRating };
}

let inflight: Promise<ReviewSummary> | null = null;

function loadSummary(): Promise<ReviewSummary> {
  if (!inflight) {
    inflight = fetch("/api/public/reviews", { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => summarizeReviews(data))
      .catch(() => EMPTY_REVIEW_SUMMARY);
  }
  return inflight;
}

/** One request per page load, shared by the hero chip and the reviews section. */
export function usePublicReviews(): ReviewSummary {
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_REVIEW_SUMMARY);
  useEffect(() => {
    let alive = true;
    void loadSummary().then((s) => {
      if (alive) setSummary(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return summary;
}
