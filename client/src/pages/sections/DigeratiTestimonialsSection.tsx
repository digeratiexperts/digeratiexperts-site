import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { ArrowRight, Loader2, Quote, Star } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  buttonSecondary,
  cardDark,
} from "@/components/home/HomeChapter";
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
    <HomeChapter tone="well" data-section="testimonials" data-testid="section-client-proof">
      <HomeContainer>
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <HomeChapterHeader
            tone="well"
            eyebrow="Client proof"
            title={
              <>
                <span className="de-hero-accent">Outcomes</span> Arizona businesses hire us for
              </>
            }
            lede="Fewer vendors, clearer security visibility, and accountable support when something breaks — backed by real client reviews from Google, Yelp, and Thumbtack."
            link={{ label: "View case studies", href: "/resources/case-studies", testId: "link-proof-case-studies" }}
          />
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          <motion.div
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
            className={`${cardDark} p-6 md:p-7 lg:col-span-7`}
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
                <div className="flex items-center gap-3">
                  <IconWell icon={Star} size="sm" surface="dark" />
                  <div>
                    <p className="font-semibold text-white">Client reviews</p>
                    <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/50">
                      Google · Yelp · Thumbtack
                    </p>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
                  We publish only real client reviews — never placeholders. Highlights from Google,
                  Yelp, and Thumbtack appear here as a single feed when live API or approved catalog
                  entries are available.
                </p>
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${buttonSecondary("well")} mt-5`}
                  data-testid="link-read-us-on-google"
                >
                  Read us on Google
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </>
            )}
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
            className={`${cardDark} flex flex-col p-6 md:p-7 lg:col-span-5`}
            data-testid="proof-outcomes"
          >
            <div className="flex items-center gap-3">
              <IconWell icon={Quote} size="sm" surface="dark" />
              <p className="font-semibold text-white">What clients hire us to improve</p>
            </div>
            <ul className="mt-5 flex-1 divide-y divide-[var(--de-hairline)]">
              {outcomes.map((o) => (
                <li key={o.title} className="py-3.5 first:pt-0 last:pb-0">
                  <p className="text-base font-semibold text-white">{o.title}</p>
                  <p className="mt-0.5 text-base leading-relaxed text-white/65">{o.detail}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => openBooking("proof_section")}
              className={`${buttonPrimary("well")} mt-6 self-start`}
              data-testid="button-proof-assessment"
            >
              {CTA.primary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--de-hairline)] pt-6 text-base sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/about/client-bill-of-rights" className="inline-flex items-center max-md:min-h-11">
              <span className="text-de-magenta-ink hover:text-[#f0187a]" data-testid="link-proof-bill-of-rights">
                Client Bill of Rights
              </span>
            </Link>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <Link href="/about/guarantee" className="inline-flex items-center max-md:min-h-11">
              <span className="text-de-magenta-ink hover:text-[#f0187a]" data-testid="link-proof-guarantee">
                Our Guarantee
              </span>
            </Link>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <Link href="/trust/trust-center" className="inline-flex items-center max-md:min-h-11">
              <span className="text-de-magenta-ink hover:text-[#f0187a]" data-testid="link-proof-trust">
                Trust Center
              </span>
            </Link>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <Link href="/industries/healthcare" className="inline-flex items-center max-md:min-h-11">
              <span className="text-de-magenta-ink hover:text-[#f0187a]">Browse industries</span>
            </Link>
          </div>
          <p className="text-sm text-white/55">
            Serving professional services, healthcare, construction, nonprofit, and regulated
            organizations across Greater Phoenix · <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>
          </p>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
