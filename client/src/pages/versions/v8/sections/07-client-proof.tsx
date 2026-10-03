import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, FileText, Scale, ShieldCheck, Star, type LucideIcon } from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { ReviewsCarousel, ReviewSourceChips } from "@/components/ReviewsCarousel";
import {
  catalogEntriesToPublic,
  GOOGLE_MAPS_CID_URL,
  listingUrlFor,
  PRIMARY_REVIEW_SOURCES,
  REVIEW_SOURCE_LABELS,
  reviewsCatalog,
  type PublicReviewItem,
  type ReviewSourceId,
} from "@/data/reviewsCatalog";
import "./07-client-proof.css";

/**
 * 07 · Client proof + Built for accountability (mock: sections/07-client-proof.html).
 * Reviews panel keeps the live honest behaviour of DigeratiTestimonialsSection: the
 * /api/public/reviews fetch with an 8s timeout and catalog fallback; real reviews only,
 * otherwise the verbatim empty state. Never invent reviews.
 */

type PublicReviewsResponse = {
  status: "ok" | "empty" | "partial";
  message: string;
  sources: ReviewSourceId[];
  reviews: PublicReviewItem[];
  mapsUri: string;
  listingUrls?: Partial<Record<ReviewSourceId, string>>;
  google?: {
    status: string;
    placeName: string | null;
    rating: number | null;
    userRatingsTotal: number | null;
  };
};

function catalogFallback(): PublicReviewsResponse {
  const reviews = catalogEntriesToPublic(reviewsCatalog);
  return {
    status: reviews.length ? "ok" : "empty",
    message: "",
    sources: Array.from(new Set(reviews.map((r) => r.source))),
    reviews,
    mapsUri: GOOGLE_MAPS_CID_URL,
    listingUrls: {
      google: GOOGLE_MAPS_CID_URL,
      ...(listingUrlFor("yelp") ? { yelp: listingUrlFor("yelp") } : {}),
      ...(listingUrlFor("thumbtack") ? { thumbtack: listingUrlFor("thumbtack") } : {}),
    },
  };
}

const outcomes = [
  { title: "Fewer vendors to manage", detail: "One accountable team for IT support and security operations." },
  { title: "Clearer security visibility", detail: "Identity, endpoint, email, and backup posture you can actually explain." },
  { title: "Faster triage when something breaks", detail: "Named ownership and documented standards — not ticket roulette." },
];

type Surface = {
  title: string;
  body: string;
  cta: string;
  href: string;
  icon: LucideIcon;
  testId: string;
  hash?: boolean;
};

const surfaces: Surface[] = [
  {
    title: "Client reviews",
    body: "Real client feedback from Google and other approved sources — shown only when we have live API data or verbatim published reviews.",
    cta: "See reviews",
    href: "/#google-reviews",
    icon: Star,
    testId: "link-proof-google-reviews",
    hash: true,
  },
  {
    title: "Client Bill of Rights",
    body: "Your credentials, tenants, and licenses stay yours — with access transparency and a clear path if you ever need to transition.",
    cta: "Read the Bill of Rights",
    href: "/about/client-bill-of-rights",
    icon: Scale,
    testId: "link-proof-section-rights",
  },
  {
    title: "Trust Center",
    body: "Security documentation and operating expectations in one place for diligence and cyber-insurance conversations.",
    cta: "Open Trust Center",
    href: "/trust/trust-center",
    icon: ShieldCheck,
    testId: "link-proof-section-trust",
  },
  {
    title: "Case studies",
    body: "Real engagements with challenge, approach, and outcome — published with client permission.",
    cta: "View case studies",
    href: "/resources/case-studies",
    icon: FileText,
    testId: "link-proof-section-cases",
  },
];

const icon = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

export function V8ClientProof(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  const [payload, setPayload] = useState<PublicReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState<ReviewSourceId | "all">("all");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const res = await fetch("/api/public/reviews", { signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as PublicReviewsResponse;
        if (!cancelled) setPayload(data);
      } catch {
        if (!cancelled) setPayload(catalogFallback());
      } finally {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const mapsHref = payload?.mapsUri || GOOGLE_MAPS_CID_URL;
  const allReviews = useMemo(() => payload?.reviews || [], [payload?.reviews]);
  const sourceFilters = useMemo(
    () =>
      payload?.sources?.length
        ? payload.sources
        : (Array.from(new Set(allReviews.map((r) => r.source))) as ReviewSourceId[]),
    [payload?.sources, allReviews],
  );
  const displayedReviews = useMemo(
    () => (activeSource === "all" ? allReviews : allReviews.filter((r) => r.source === activeSource)),
    [allReviews, activeSource],
  );
  const hasReviews = !loading && displayedReviews.length > 0;
  const googleMeta = payload?.google;
  const showGoogleAverage =
    hasReviews &&
    (activeSource === "all" || activeSource === "google") &&
    googleMeta?.status === "ok" &&
    typeof googleMeta.rating === "number";

  const listingLinks = useMemo(() => {
    const urls = payload?.listingUrls || {};
    const items: { id: ReviewSourceId; href: string; label: string }[] = [];
    for (const id of PRIMARY_REVIEW_SOURCES) {
      const href = urls[id] || listingUrlFor(id);
      if (!href) continue;
      items.push({ id, href, label: REVIEW_SOURCE_LABELS[id] });
    }
    if (!items.some((item) => item.id === "google")) {
      items.unshift({ id: "google", href: mapsHref, label: REVIEW_SOURCE_LABELS.google });
    }
    return items;
  }, [payload?.listingUrls, mapsHref]);

  const readUsLink = (link: { id: ReviewSourceId; href: string; label: string }) => (
    <a
      key={link.id}
      className="v8-link"
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={link.id === "google" ? "link-read-us-on-google" : `link-read-us-on-${link.id}`}
    >
      Read us on {link.label} <ArrowUpRight {...icon} />
    </a>
  );

  return (
    <section
      className="f-well v8-section proof"
      aria-labelledby="proof-heading"
      data-section="testimonials"
      data-testid="section-client-proof"
    >
      <div className="v8-canvas">
        <motion.header className="v8-head" {...reveal}>
          <p className="v8-eyebrow">Client proof</p>
          <h2 className="v8-h2" id="proof-heading">
            <span className="v8-accent">Outcomes</span> Arizona businesses hire us for
          </h2>
          <p className="v8-lede">
            Fewer vendors, clearer security visibility, and accountable support when something breaks — backed by
            real client reviews from Google, Yelp, and Thumbtack.
          </p>
        </motion.header>

        {/* (1) What clients hire us to improve */}
        <motion.div className="proof-outcomes" data-testid="proof-outcomes" {...reveal}>
          <h3 className="v8-h4">What clients hire us to improve</h3>
          <ul className="proof-cells">
            {outcomes.map((o, i) => (
              <li key={o.title}>
                <span className="v8-seq" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h4 className="v8-h4">{o.title}</h4>
                <p className="v8-body">{o.detail}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* (2) Honest reviews panel + case studies */}
        <motion.div className="proof-pair" {...reveal}>
          <article
            className="v8-card v8-card--inset proof-panel"
            id="google-reviews"
            aria-labelledby="reviews-title"
            aria-busy={loading || undefined}
            data-testid="proof-reviews-slot"
          >
            <h3 className="v8-h3" id="reviews-title">
              Client reviews
            </h3>
            {hasReviews ? (
              <>
                {showGoogleAverage ? (
                  <p className="proof-sources">
                    {googleMeta!.rating!.toFixed(1)}
                    {googleMeta!.userRatingsTotal != null
                      ? ` · ${googleMeta!.userRatingsTotal} on Google`
                      : " avg on Google"}
                  </p>
                ) : (
                  sourceFilters.length === 1 && (
                    <p className="proof-sources">
                      From {REVIEW_SOURCE_LABELS[sourceFilters[0]!]}
                      {allReviews.every((r) => r.origin === "catalog") ? " (published with permission)" : ""}
                    </p>
                  )
                )}
                <div className="mt-4">
                  <ReviewSourceChips sources={sourceFilters} active={activeSource} onChange={setActiveSource} />
                </div>
                <div className="mt-4">
                  <ReviewsCarousel reviews={displayedReviews} prefersReducedMotion={prefersReducedMotion} />
                </div>
                <div className="proof-panel__actions">{listingLinks.map(readUsLink)}</div>
              </>
            ) : (
              <>
                <p className="proof-sources">Google · Yelp · Thumbtack</p>
                {loading ? (
                  <p className="v8-body" role="status">
                    Loading reviews…
                  </p>
                ) : (
                  <p className="v8-body">
                    We publish only real client reviews — never placeholders. Highlights from Google, Yelp, and
                    Thumbtack appear here as a single feed when live API or approved catalog entries are available.
                  </p>
                )}
                <div className="proof-panel__actions">
                  {readUsLink({ id: "google", href: mapsHref, label: REVIEW_SOURCE_LABELS.google })}
                </div>
              </>
            )}
          </article>

          <article className="v8-card v8-card--inset proof-panel" aria-labelledby="cases-title">
            <h3 className="v8-h3" id="cases-title">
              Case studies
            </h3>
            <p className="v8-body">
              See how we approach real Arizona engagements — challenge, approach, and outcome.
            </p>
            <div className="proof-panel__actions">
              <Link
                className="v8-btn v8-btn--outline"
                href="/resources/case-studies"
                data-testid="link-proof-case-studies"
              >
                View case studies <ArrowRight {...icon} />
              </Link>
              <a
                className="v8-link"
                href="/book"
                onClick={(e) => {
                  e.preventDefault();
                  openBooking("proof_section");
                }}
                data-testid="button-proof-assessment"
              >
                {CTA.primary} <ArrowRight {...icon} />
              </a>
            </div>
          </article>
        </motion.div>

        {/* (3) Built for accountability you can verify */}
        <section className="proof-verify" id="proof" aria-labelledby="verify-heading">
          <motion.header {...reveal}>
            <h2 className="v8-h2--sub" id="verify-heading">
              Built for accountability you can verify
              <span className="v8-colon" aria-hidden="true">
                :
              </span>
            </h2>
            <p className="v8-body">
              Ownership clarity, documented operations, and public surfaces you can open before you engage — not
              marketing claims you have to take on faith.
            </p>
          </motion.header>

          <motion.ul className="v8-cells proof-rail" aria-label="Trust and transparency surfaces" {...reveal}>
            {surfaces.map((s) => {
              const Icon = s.icon;
              const label = (
                <>
                  {s.cta} <ArrowRight {...icon} />
                </>
              );
              return (
                <li key={s.title}>
                  <span className="v8-iconwell">
                    <Icon {...icon} />
                  </span>
                  <h3 className="v8-h4">{s.title}</h3>
                  <p className="v8-body">{s.body}</p>
                  {s.hash ? (
                    <a className="v8-link" href={s.href} data-testid={s.testId}>
                      {label}
                    </a>
                  ) : (
                    <Link className="v8-link" href={s.href} data-testid={s.testId}>
                      {label}
                    </Link>
                  )}
                </li>
              );
            })}
          </motion.ul>

          {/* (4) One quiet serving line */}
          <div className="proof-foot">
            <p className="v8-small">
              Serving professional services, healthcare, construction, nonprofit, and regulated organizations across
              Greater Phoenix<span className="proof-foot__sep"> · </span>
              <span className="proof-foot__phonewrap">
                <a className="proof-foot__phone" href={PRIMARY_PHONE.telHref}>
                  {PRIMARY_PHONE.display}
                </a>
              </span>
            </p>
            <nav className="proof-foot__links" aria-label="More trust pages">
              <Link className="v8-link--quiet" href="/about/guarantee" data-testid="link-proof-guarantee">
                Our Guarantee
              </Link>
              <Link className="v8-link--quiet" href="/industries/healthcare">
                Browse industries
              </Link>
            </nav>
          </div>
        </section>
      </div>
    </section>
  );
}
