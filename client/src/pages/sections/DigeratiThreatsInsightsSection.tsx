import { Calendar, ArrowRight, AlertCircle, Shield, Bug, Lock, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { HomeChapter, HomeChapterHeader, HomeContainer, buttonPrimary, buttonSecondary, cardDark } from "@/components/home/HomeChapter";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useRef, useState, useEffect, useMemo } from "react";
import { useThreatFeed } from "@/hooks/useThreatFeed";
import {
  formatThreatDate,
  THREAT_ATTRIBUTION,
  type ThreatCategory,
  type ThreatItem,
} from "@shared/threatFeed";

const categoryIcon: Record<ThreatCategory, JSX.Element> = {
  "Active Exploitation": <AlertCircle className="h-5 w-5" />,
  "Threat Advisory": <Shield className="h-5 w-5" />,
  "Critical Vulnerability": <Bug className="h-5 w-5" />,
  "Malware Activity": <Bug className="h-5 w-5" />,
  Ransomware: <AlertCircle className="h-5 w-5" />,
  "Microsoft Security": <Lock className="h-5 w-5" />,
  "Digerati Advisory": <Shield className="h-5 w-5" />,
};

function categoryBadgeClass(item: ThreatItem): string {
  if (item.severity === "critical") return "bg-red-50 text-red-700 border-red-200";
  if (item.severity === "high") return "border-[#D3126A] bg-transparent text-[#A30E52]";
  return "border-[var(--de-paper-hairline)] bg-transparent text-[#5A5368]";
}

function InsightCard({ insight, index }: { insight: ThreatItem; index: number }) {
  return (
    <Card
      className="de-paper-on-well de-interactive-card group relative h-full overflow-hidden rounded-xl bg-white shadow-none"
      data-testid={`insight-card-${index}`}
    >
      <CardHeader className="pb-3 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3 gap-2">
          <Badge className={`${categoryBadgeClass(insight)} shrink-0 border text-xs font-semibold py-1 px-2.5 rounded-full`}>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {categoryIcon[insight.category]}
              <span className="hidden sm:inline">{insight.category}</span>
              <span className="sm:hidden">{insight.category.split(" ")[0]}</span>
            </span>
          </Badge>
          <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-[#5A5368]">
            <Calendar className="h-3.5 w-3.5 text-[#D3126A]" />
            <span className="hidden sm:inline">{formatThreatDate(insight.publishedAt)}</span>
            <span className="sm:hidden">{formatThreatDate(insight.publishedAt, "short")}</span>
          </span>
        </div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#D3126A]">
          {insight.kicker}
        </p>
        <CardTitle className="line-clamp-2 text-base font-bold leading-snug text-[#1A1228] sm:text-lg">
          {insight.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 sm:p-6 pt-0">
        <CardDescription className="mb-4 line-clamp-3 text-xs leading-relaxed text-black/60 sm:text-sm">
          {insight.excerpt}
        </CardDescription>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--de-paper-hairline)] pt-4 text-xs">
          <span className="truncate font-mono text-[#5A5368]">
            {insight.sourceName}
            {insight.vendor ? ` · ${insight.vendor}` : ""}
            {insight.cve ? ` · ${insight.cve}` : ""}
          </span>
          <a
            href={insight.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 font-semibold text-[#D3126A] hover:text-[#f0187a]"
          >
            Read source
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export const DigeratiThreatsInsightsSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeCategory, setActiveCategory] = useState<"All" | ThreatCategory>("All");
  const { payload, loading } = useThreatFeed("homepage");
  const insights = payload.items;

  const categories = useMemo(() => {
    const present = Array.from(new Set(insights.map((item) => item.category)));
    return present.length ? (["All", ...present] as Array<"All" | ThreatCategory>) : [];
  }, [insights]);
  const displayed = useMemo(
    () => (activeCategory === "All" ? insights : insights.filter((item) => item.category === activeCategory)),
    [insights, activeCategory],
  );

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollButtons);
      checkScrollButtons();
      return () => container.removeEventListener("scroll", checkScrollButtons);
    }
  }, [displayed.length]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -320 : 320,
        behavior: "smooth",
      });
    }
  };

  const gridClass =
    displayed.length >= 4
      ? "hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8"
      : "hidden lg:grid grid-cols-3 gap-5 mb-8";

  return (
    <HomeChapter tone="surface" className="overflow-hidden">
      <HomeContainer>
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <HomeChapterHeader
            tone="surface"
            eyebrow="Threat intelligence"
            title="Recent Threats & Insights"
            lede={
              <>
                Current items prioritized by active exploitation, exploit probability, and SMB relevance.
                Full stream, dates, and sources live on{" "}
                <Link href="/resources/security-updates" className="font-semibold text-white underline decoration-white/25 underline-offset-4 hover:decoration-white/50">
                  Security Updates
                </Link>
                .
              </>
            }
          />
        </motion.div>

        {categories.length > 2 && (
          <motion.div
            className="flex overflow-x-auto scrollbar-hide gap-2 mb-6 pb-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-2 text-base font-medium transition-colors ${
                  activeCategory === category
                    ? "border-[#D3126A] bg-transparent text-white shadow-[inset_0_0_0_1px_#D3126A]"
                    : "border-[var(--de-hairline)] bg-transparent text-white/70 hover:border-white/25 hover:text-white"
                }`}
                data-testid={`filter-${category.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {category}
              </button>
            ))}
          </motion.div>
        )}

        {loading ? (
          <div className={`${cardDark} mb-8 max-w-2xl p-6`} data-testid="insights-loading">
            <p className="text-lg font-semibold text-white">Loading current threats…</p>
            <p className="mt-2 text-base leading-relaxed text-white/65">
              Checking CISA, FIRST, NVD, and Microsoft MSRC. Nothing is invented while this loads.
            </p>
          </div>
        ) : displayed.length === 0 ? (
          <div className={`${cardDark} mb-8 max-w-2xl p-6`} data-testid="insights-empty">
            <p className="text-lg font-semibold text-white">No current items meet the homepage threshold.</p>
            <p className="mt-2 text-base leading-relaxed text-white/65">
              We only promote threats with confirmed exploitation, high exploit probability, or clear
              SMB relevance — and only within the last 45 days. The full stream stays on Security
              Updates with dates and sources.
            </p>
          </div>
        ) : (
          <>
            <div className="lg:hidden relative mb-8">
              <button
                onClick={() => scroll("left")}
                className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all ${
                  canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-label="Scroll left"
                data-testid="threats-scroll-left"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => scroll("right")}
                className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all ${
                  canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-label="Scroll right"
                data-testid="threats-scroll-right"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
              <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-de-surface to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-de-surface to-transparent z-10 pointer-events-none" />
              <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-2 snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {displayed.map((insight, index) => (
                  <div key={insight.id} className="flex-shrink-0 w-[300px] sm:w-[340px] snap-center">
                    <InsightCard insight={insight} index={index} />
                  </div>
                ))}
              </div>
            </div>

            <div className={gridClass}>
              {displayed.map((insight, index) => (
                <motion.div
                  key={insight.id}
                  initial={prefersReducedMotion ? false : revealInitial}
                  whileInView={revealInView}
                  viewport={revealViewport}
                  transition={{ ...revealTransition, delay: index * 0.04 }}
                >
                  <InsightCard insight={insight} index={index} />
                </motion.div>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-5 border-t border-[var(--de-hairline)] pt-6 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            {payload.attribution || THREAT_ATTRIBUTION}
          </p>
          <motion.div
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <Link href="/resources/security-updates" className={buttonPrimary("surface")} data-testid="view-all-updates">
              View All Security Updates
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/resources/blog" className={buttonSecondary("surface")} data-testid="view-digerati-journal">
              Read the Digerati Journal
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </motion.div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
