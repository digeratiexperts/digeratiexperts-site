import { useEffect, useState } from "react";
import {
  catalogEntriesToPublic,
  GOOGLE_MAPS_CID_URL,
  reviewsCatalog,
  type PublicReviewItem,
} from "@/data/reviewsCatalog";
import { QuietLink, T } from "./V4Primitives";

/**
 * Chapter 08's third kind of proof: what clients have written, verbatim.
 *
 * Same pipeline as the production homepage's Client Proof section
 * (DigeratiTestimonialsSection): GET /api/public/reviews, which merges live
 * Google Places (when GOOGLE_PLACE_ID is valid) with the curated verbatim
 * catalog, falling back to the catalog alone if the request fails. So the
 * moment DE pastes a real review into client/src/data/reviewsCatalog.ts —
 * or Places starts answering — it appears here, with no V4 change.
 *
 * Rules, from design/PROOF_SYSTEM.md and docs/GOOGLE-REVIEWS.md:
 *   - text, name, rating and date exactly as the source shows them. A review
 *     is shown whole or not at all; long ones are left for the listing
 *     rather than cut;
 *   - live reviews say "Live from Google"; catalog entries say "published
 *     with permission", production's own wording;
 *   - an average only when Google itself returned one;
 *   - an empty feed shows production's honest empty-state sentence and the
 *     link to the listing. Never a placeholder row, never a raw error.
 */

type Payload = {
  reviews: PublicReviewItem[];
  mapsUri?: string;
  google?: { status: string; rating: number | null; userRatingsTotal: number | null };
};

const MAX_SHOWN = 3;
const MAX_CHARS = 420;

/** Feed order (the catalog's curation, or Google's), whole reviews only. */
export function pickReviews(reviews: PublicReviewItem[]): PublicReviewItem[] {
  const valid = reviews.filter((r) => r.text?.trim() && r.authorName?.trim());
  const whole = valid.filter((r) => r.text.trim().length <= MAX_CHARS);
  return (whole.length ? whole : valid.slice(0, 1)).slice(0, MAX_SHOWN);
}

function ratingText(rating: number): string | null {
  return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? `${rating} of 5` : null;
}

export function V4Reviews() {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const res = await fetch("/api/public/reviews", { signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as Payload;
        if (!cancelled) setPayload({ ...data, reviews: Array.isArray(data.reviews) ? data.reviews : [] });
      } catch {
        if (!cancelled) {
          setPayload({ reviews: catalogEntriesToPublic(reviewsCatalog), mapsUri: GOOGLE_MAPS_CID_URL });
        }
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const shown = payload ? pickReviews(payload.reviews) : [];
  const state = payload === null ? "loading" : shown.length ? "reviews" : "empty";
  const listing = payload?.mapsUri || GOOGLE_MAPS_CID_URL;
  const google = payload?.google;
  const average =
    state === "reviews" && google?.status === "ok" && typeof google.rating === "number"
      ? `${google.rating.toFixed(1)} average${
          google.userRatingsTotal != null ? ` across ${google.userRatingsTotal} reviews` : ""
        } on Google`
      : null;

  return (
    <div className="mt-16 border-t border-white/15 pt-8" data-testid="v4-reviews" data-state={state}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        {/* The label only promises clients' words when there are some. */}
        <p className={`${T.label} text-white/55`}>
          {state === "reviews" ? "In clients’ own words" : "Client reviews"}
        </p>
        {average && <p className={`${T.mono} text-white/60`}>{average}</p>}
      </div>

      {state === "reviews" ? (
        <div className="mt-6 grid gap-10 md:grid-cols-3 md:gap-8">
          {shown.map((r) => {
            const rating = ratingText(r.rating);
            const origin = r.origin === "live" ? `Live from ${r.sourceLabel}` : `${r.sourceLabel}, published with permission`;
            return (
              <figure key={r.id} className="min-w-0" data-testid="v4-review" data-origin={r.origin}>
                <blockquote className={`${T.lede} text-de-paper`}>“{r.text.trim()}”</blockquote>
                <figcaption className={`mt-3 ${T.mono} text-white/60`}>
                  {[r.authorName.trim(), rating, origin, r.relativeTime].filter(Boolean).join(" · ")}
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : (
        <p className={`mt-4 max-w-[58ch] ${T.body} text-white/60`}>
          We publish only real client reviews, verbatim — never placeholders.
        </p>
      )}

      <div className="mt-6">
        <QuietLink href={listing} testId="v4-link-google-reviews" external>
          Read us on Google
        </QuietLink>
      </div>
    </div>
  );
}
