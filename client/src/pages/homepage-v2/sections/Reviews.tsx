import { usePublicReviews } from "@/lib/publicReviews";

/**
 * Homepage review proof. Both pieces render nothing until real reviews exist
 * (client/src/lib/publicReviews.ts), so an empty feed leaves no gap and no fake row.
 */

/** "★ 4.9 · 23 Google reviews" beside the hero CTAs, only with Google's own numbers. */
export function ReviewChip(): JSX.Element | null {
  const { googleRating } = usePublicReviews();
  if (!googleRating) return null;
  const label = `${googleRating.rating.toFixed(1)} out of 5 from ${googleRating.count} Google reviews`;
  const body = (
    <>
      <span aria-hidden="true" className="rev-star">★</span>
      <b>{googleRating.rating.toFixed(1)}</b>
      <span>· {googleRating.count} Google reviews</span>
    </>
  );
  return googleRating.href ? (
    <a className="rev-chip" href={googleRating.href} target="_blank" rel="noopener noreferrer" aria-label={label} data-testid="hero-review-chip">
      {body}
    </a>
  ) : (
    <span className="rev-chip" aria-label={label} data-testid="hero-review-chip">{body}</span>
  );
}

/** Up to three verbatim reviews, newest first as the feed returns them. */
export function ReviewsList(): JSX.Element | null {
  const { reviews, googleRating } = usePublicReviews();
  if (reviews.length === 0) return null;
  return (
    <div className="reviews" id="reviews" data-testid="home-reviews">
      <div className="reviews-head">
        <h3>What clients say</h3>
        {googleRating ? (
          <p className="muted small">
            {googleRating.rating.toFixed(1)} out of 5 on Google from {googleRating.count} reviews
          </p>
        ) : null}
      </div>
      <div className="grid g3">
        {reviews.slice(0, 3).map((review) => (
          <figure className="card review" key={review.id}>
            <p className="rev-stars" aria-label={`${review.rating} out of 5 stars`}>
              {"★".repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}
            </p>
            <blockquote>
              <p>{review.text}</p>
            </blockquote>
            <figcaption className="muted small">
              {review.authorName}
              {" · "}
              {review.url ? (
                <a className="link" href={review.url} target="_blank" rel="noopener noreferrer">
                  {review.sourceLabel}
                </a>
              ) : (
                review.sourceLabel
              )}
              {review.relativeTime ? ` · ${review.relativeTime}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
