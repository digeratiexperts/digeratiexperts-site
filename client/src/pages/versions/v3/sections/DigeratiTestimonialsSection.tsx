// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiTestimonialsSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { ArrowRight, Building2, Loader2, Quote } from "lucide-react";
import { Link } from "wouter";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
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
import { PRIMARY_PHONE } from "@/data/companyContact";
import { EvidenceFrame } from "@/components/evidence/EvidenceFrame";

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

const outcomes = [
  {
    title: "Fewer vendors to manage",
    detail: "One accountable team for IT support and security operations.",
  },
  {
    title: "Clearer security visibility",
    detail: "Identity, endpoint, email, and backup posture you can actually explain.",
  },
  {
    title: "Faster triage when something breaks",
    detail: "Named ownership and documented standards — not ticket roulette.",
  },
];

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

export const DigeratiTestimonialsSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();
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
  const allReviews = payload?.reviews || [];
  const sourceFilters = useMemo(() => {
    const ids = payload?.sources?.length
      ? payload.sources
      : (Array.from(new Set(allReviews.map((r) => r.source))) as ReviewSourceId[]);
    return ids;
  }, [payload?.sources, allReviews]);

  const displayedReviews = useMemo(() => {
    if (activeSource === "all") return allReviews;
    return allReviews.filter((r) => r.source === activeSource);
  }, [allReviews, activeSource]);

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
      items.unshift({
        id: "google",
        href: mapsHref,
        label: REVIEW_SOURCE_LABELS.google,
      });
    }
    return items;
  }, [payload?.listingUrls, mapsHref]);

  return (
    <section
      id="testimonials"
      className="de-dark-well de-chapter-hairline de-field-grain relative overflow-hidden py-14 md:py-18 lg:py-20"
      data-testid="section-client-proof"
    >
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <motion.div
          className="mb-10 text-center md:mb-14"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <p className="mb-3 text-base font-medium uppercase tracking-wide text-de-magenta-ink">
            How DE delivers
          </p>
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            <span className="de-hero-accent">Outcomes</span> Arizona businesses hire us for
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
            Fewer vendors, clearer security visibility, and accountable support when something
            breaks — backed by real client reviews from Google, Yelp, and Thumbtack.
          </p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
          className="mb-8 rounded-2xl border border-de-hairline bg-de-raised p-6 md:p-8"
          data-testid="proof-reviews-slot"
          id="google-reviews"
        >
          {loading ? (
            <div className="flex items-center gap-2 text-base text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading reviews…
            </div>
          ) : hasReviews ? (
            <>
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-semibold text-white">Client reviews</p>
                  {showGoogleAverage && (
                    <p className="mt-1 text-base text-white/70">
                      {googleMeta!.rating!.toFixed(1)}
                      {googleMeta!.userRatingsTotal != null
                        ? ` · ${googleMeta!.userRatingsTotal} on Google`
                        : " avg on Google"}
                    </p>
                  )}
                  {sourceFilters.length === 1 && (
                    <p className="mt-1 text-base text-white/55">
                      From {REVIEW_SOURCE_LABELS[sourceFilters[0]!]}
                      {allReviews.every((r) => r.origin === "catalog")
                        ? " (published with permission)"
                        : ""}
                    </p>
                  )}
                </div>
                <ReviewSourceChips
                  sources={sourceFilters}
                  active={activeSource}
                  onChange={setActiveSource}
                />
              </div>

              <ReviewsCarousel
                reviews={displayedReviews}
                prefersReducedMotion={prefersReducedMotion}
              />

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
                {listingLinks.map((link, i) => (
                  <span key={link.id} className="inline-flex items-center gap-4">
                    {i > 0 && (
                      <span className="text-white/25" aria-hidden>
                        ·
                      </span>
                    )}
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-de-magenta-ink hover:text-[#f0187a]"
                      data-testid={
                        link.id === "google" ? "link-read-us-on-google" : `link-read-us-on-${link.id}`
                      }
                    >
                      Read us on {link.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mb-1 font-semibold text-white">Client reviews</p>
              <p className="mb-3 text-base font-medium uppercase tracking-[0.16em] text-white/50">
                Google · Yelp · Thumbtack
              </p>
              <p className="mb-4 max-w-2xl text-base leading-relaxed text-white/55">
                We publish only real client reviews — never placeholders. Highlights from Google,
                Yelp, and Thumbtack appear here as a single feed when live API or approved catalog
                entries are available.
              </p>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-base font-semibold text-[#1a0a2e] transition-colors hover:bg-pink-50"
                data-testid="link-read-us-on-google"
              >
                Read us on Google
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
          className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8"
          data-testid="proof-outcomes"
        >
          <div className="rounded-2xl border border-de-hairline bg-de-raised p-7 md:p-8 lg:col-span-7">
            <div className="mb-5 flex items-start gap-3">
              <Quote className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#D3126A]" aria-hidden="true" />
              <p className="font-semibold text-white">What clients hire us to improve</p>
            </div>
            <dl className="divide-y divide-[var(--de-hairline)] border-y border-[var(--de-hairline)]">
              {outcomes.map((o, index) => (
                <div key={o.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-4 md:py-5">
                  <dt className="pt-1 font-mono text-xs font-bold tracking-[0.18em] text-[#D3126A]" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </dt>
                  <div>
                    <dt className="text-base font-semibold text-white md:text-lg">{o.title}</dt>
                    <dd className="mt-1 text-base leading-relaxed text-white/60">{o.detail}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-5">
            <EvidenceFrame
              classification="SANITIZED_REAL"
              title="How DE delivers support: DE Desk, built into digeratiexperts.com"
              subtitle="A capture of DE's own product, not a client's. Clients reach support, tools, and sign-in from the site itself."
              status="informational"
              statusLabel="DE's own product"
              sourceNote="Captured from the live site; no client data shown."
              variant="dark"
              className="h-full"
            >
              <div className="flex justify-center">
                <img
                  src="/images/evidence/de-desk-support.webp"
                  alt="DE Desk support surface as it appears on digeratiexperts.com, showing the support entry points"
                  width={390}
                  height={844}
                  loading="lazy"
                  decoding="async"
                  className="max-h-[420px] w-auto rounded-lg border border-de-hairline"
                  data-testid="img-proof-de-desk"
                />
              </div>
            </EvidenceFrame>
          </div>
        </motion.div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-pink-400" aria-hidden="true" />
            <div>
              <p className="text-base font-medium text-white">Case studies</p>
              <p className="text-base leading-relaxed text-white/55">
                See how we approach real Arizona engagements — challenge, approach, and outcome.
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row">
            <Link href="/resources/case-studies">
              <span
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-base font-semibold text-white hover:border-[#D3126A]/60"
                data-testid="link-proof-case-studies"
              >
                View case studies
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openBooking("proof_section")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#D3126A] px-5 py-3 text-base font-semibold text-white hover:bg-[#e01874]"
              data-testid="button-proof-assessment"
            >
              {CTA.primary}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-base">
          <Link href="/about/client-bill-of-rights">
            <span className="text-de-magenta-ink hover:text-[#f0187a]" data-testid="link-proof-bill-of-rights">
              Client Bill of Rights
            </span>
          </Link>
          <span className="text-white/25" aria-hidden="true">
            ·
          </span>
          <Link href="/about/guarantee">
            <span className="text-de-magenta-ink hover:text-[#f0187a]" data-testid="link-proof-guarantee">
              Our Guarantee
            </span>
          </Link>
          <span className="text-white/25" aria-hidden="true">
            ·
          </span>
          <Link href="/trust/trust-center">
            <span className="text-de-magenta-ink hover:text-[#f0187a]" data-testid="link-proof-trust">
              Trust Center
            </span>
          </Link>
          <span className="text-white/25" aria-hidden="true">
            ·
          </span>
          <Link href="/industries/healthcare">
            <span className="text-de-magenta-ink hover:text-[#f0187a]">Browse industries</span>
          </Link>
        </div>
        <p className="mt-4 text-center text-base text-white/55">
          Serving professional services, healthcare, construction, nonprofit, and regulated
          organizations across Greater Phoenix · {PRIMARY_PHONE.display}
        </p>
      </div>
    </section>
  );
};
