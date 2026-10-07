/**
 * Multi-source reviews catalog for the public site.
 *
 * Paste ONLY real, verbatim reviews DE approved for publication.
 * Do NOT invent quotes, ratings, names, or counts.
 *
 * Live Google Places (when GOOGLE_PLACE_ID works) and optional Yelp Fusion
 * merge in via GET /api/public/reviews and take priority for matching text.
 *
 * @see docs/GOOGLE-REVIEWS.md
 */

import { thumbtackReviewsManual } from "./thumbtackReviewsManual";
import { yelpReviewsManual } from "./yelpReviewsManual";

export type ReviewSourceId =
  | "google"
  | "yelp"
  | "thumbtack"
  | "facebook"
  | "clutch"
  | "other";

export type CatalogReview = {
  source: ReviewSourceId;
  authorName: string;
  /** 1–5 as shown on the source platform */
  rating: number;
  text: string;
  /** Optional relative time as shown on the source, e.g. "2 months ago" */
  relativeTime?: string;
  /** Optional deep link to the review or listing */
  url?: string;
  /** Optional ISO date when known */
  publishedAt?: string;
};

export type PublicReviewItem = {
  id: string;
  source: ReviewSourceId;
  sourceLabel: string;
  origin: "live" | "catalog";
  authorName: string;
  rating: number;
  text: string;
  relativeTime?: string;
  url?: string;
  publishedAt?: string;
};

/** Maps link for the verified service-area listing (CID — not a Place ID). */
export const GOOGLE_MAPS_CID_URL =
  "https://maps.google.com/?cid=1710856351091471339";

/**
 * Official "leave a review" link from the verified Google Business Profile
 * (GBP → Ask for reviews). Opens the review form directly.
 */
export const GOOGLE_REVIEW_URL = "https://g.page/r/Ceszh2zJLr4XEBM/review";

/** Static QR code that encodes GOOGLE_REVIEW_URL (generated, verified to scan). */
export const GOOGLE_REVIEW_QR_SRC = "/images/reviews/google-review-qr.svg";

/**
 * Official Yelp biz URL. Leave empty until DE pastes the real listing.
 * // TODO: Await actual client copy from Joseph Petro
 */
export const YELP_LISTING_URL = "";

/**
 * Official Thumbtack profile URL. Leave empty until DE pastes the real listing.
 * // TODO: Await actual client copy from Joseph Petro
 */
export const THUMBTACK_LISTING_URL = "";

export const REVIEW_SOURCE_LABELS: Record<ReviewSourceId, string> = {
  google: "Google",
  yelp: "Yelp",
  thumbtack: "Thumbtack",
  facebook: "Facebook",
  clutch: "Clutch",
  other: "Review",
};

/** Preferred chip / feed order. Other sources append after these. */
export const PRIMARY_REVIEW_SOURCES: ReviewSourceId[] = [
  "google",
  "yelp",
  "thumbtack",
];

export function listingUrlFor(source: ReviewSourceId): string | undefined {
  if (source === "google") return GOOGLE_MAPS_CID_URL;
  if (source === "yelp" && YELP_LISTING_URL) return YELP_LISTING_URL;
  if (source === "thumbtack" && THUMBTACK_LISTING_URL) return THUMBTACK_LISTING_URL;
  return undefined;
}

export function reviewIdentity(authorName: string, text: string): string {
  return `${authorName.trim().toLowerCase()}::${text.trim().toLowerCase()}`;
}

export function catalogEntriesToPublic(
  entries: CatalogReview[],
): PublicReviewItem[] {
  return entries
    .filter((entry) => entry?.text?.trim() && entry?.authorName?.trim())
    .map((entry, index) => ({
      id: `catalog-${entry.source}-${index}`,
      source: entry.source,
      sourceLabel: REVIEW_SOURCE_LABELS[entry.source],
      origin: "catalog",
      authorName: entry.authorName.trim(),
      rating: entry.rating,
      text: entry.text.trim(),
      relativeTime: entry.relativeTime,
      url: entry.url || listingUrlFor(entry.source),
      publishedAt: entry.publishedAt,
    }));
}

/**
 * Google pastes (interim when Places is unconfigured).
 * Example only — do not commit fabricated content:
 *
 * {
 *   source: "google",
 *   authorName: "Exact name from Google",
 *   rating: 5,
 *   text: "Exact review body from Google",
 *   relativeTime: "3 months ago",
 *   url: GOOGLE_MAPS_CID_URL,
 * }
 */
const googleManualReviews: CatalogReview[] = [];

/**
 * Curated reviews. Yelp / Thumbtack files stay empty until DE pastes
 * verbatim platform copy. Empty catalog → honest empty state.
 */
export const reviewsCatalog: CatalogReview[] = [
  ...googleManualReviews,
  ...yelpReviewsManual,
  ...thumbtackReviewsManual,
];
