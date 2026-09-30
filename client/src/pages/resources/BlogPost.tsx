import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toWebImageUrl } from "@/lib/webImage";
import { useParams, Link, Redirect } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { Helmet } from "react-helmet-async";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { ReadingProgressBar } from "@/components/ReadingProgressBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  ChevronRight,
  ArrowRight,
  Share2,
  Linkedin,
  Twitter,
  Link2,
  Check,
  List,
  Lightbulb,
  AlertTriangle,
  Info,
  Sparkles,
  Quote,
} from "lucide-react";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { BlogAudioPlayer } from "@/components/BlogAudioPlayer";
import { blogs, blogBySlug, blogBodies } from "@/data/resourceRegistry";

const LEGACY_SLUG_REDIRECTS: Record<string, string> = {
  "why-small-businesses-outgrow-reactive-it-support": "managed-it-vs-break-fix-it",
  "it-support-vs-cybersecurity-first-managed-it": "managed-it-vs-break-fix-it",
  "what-a-cyber-risk-assessment-should-show-you":
    "what-a-cyber-risk-assessment-finds-before-attackers-do",
  "backup-isnt-recovery-what-real-bcdr-looks-like":
    "can-ransomware-encrypt-your-backups",
  "co-managed-vs-fully-managed-it":
    "co-managed-it-vs-hiring-another-it-employee",
  "ransomware-defense-arizona-businesses":
    "multilayer-ransomware-defense-arizona-businesses",
  "ransomware-protection": "multilayer-ransomware-defense-arizona-businesses",
  ransomware: "multilayer-ransomware-defense-arizona-businesses",
  "phishing-2026-mfa-alone-isnt-enough":
    "why-mfa-alone-does-not-stop-ransomware",
};

function isWordToken(t: string): boolean {
  return /[A-Za-z0-9\u00C0-\u024F]/.test(t);
}

function renderTokens(
  text: string,
  counter: { value: number },
): ReactNode {
  const parts = text.split(/(\s+)/);
  return parts.map((tok, i) => {
    if (!tok) return null;
    if (/^\s+$/.test(tok)) return tok;
    if (!isWordToken(tok)) return tok;
    const idx = counter.value++;
    return (
      <span key={i} className="blog-word" data-w={idx}>
        {tok}
      </span>
    );
  });
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(isWordToken).length;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const seoPost = slug ? blogBySlug(slug) : undefined;
  // House SEO mechanism: updates the existing canonical link (no duplicate
  // tags) and sets og:url/twitter/robots — per-post instead of the homepage
  // default (error-sweep, 2026-08-31). Hook runs unconditionally.
  useSEO({
    title: seoPost?.seoTitle ?? "Digerati Journal",
    description: seoPost?.seoDescription,
    canonical: slug ? `/resources/blog/${slug}` : undefined,
    ogImage: seoPost?.coverImage,
  });
  const articleRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  const post = slug ? blogBySlug(slug) : undefined;
  const body = slug ? blogBodies[slug] : undefined;

  const relatedPosts = useMemo(() => {
    if (!post) return [];
    const sameCategory = blogs.filter(
      (b) => b.slug !== post.slug && b.category === post.category,
    );
    const others = blogs.filter(
      (b) => b.slug !== post.slug && b.category !== post.category,
    );
    return [...sameCategory, ...others].slice(0, 3);
  }, [post]);

  const hasDualVersion = !!(body?.overviewBlocks && body?.extendedBlocks);
  const [view, setView] = useState<"overview" | "extended">("overview");

  const activeBlocks = useMemo(() => {
    if (!body) return [];
    if (hasDualVersion) {
      return view === "overview" ? body.overviewBlocks! : body.extendedBlocks!;
    }
    return body.blocks ?? [];
  }, [body, hasDualVersion, view]);

  const activeReadTime = hasDualVersion
    ? (view === "overview" ? body?.overviewReadTime : body?.extendedReadTime) ??
      body?.readTime
    : body?.readTime;

  const audioText = useMemo(() => {
    const blocks = activeBlocks;
    return blocks
      .map((b) => {
        if (b.kind === "p") {
          const raw = b.text.trim();
          if (raw.startsWith("> ")) return raw.slice(2);
          return raw;
        }
        if (b.kind === "h2") return b.text;
        if (b.kind === "ul") return b.items.join(". ");
        if (b.kind === "callout") return `${b.title ?? ""}: ${b.text}`.trim();
        if (b.kind === "quote") return b.text;
        return "";
      })
      .filter(Boolean)
      .join(". ");
  }, [activeBlocks]);

  const totalWords = useMemo(() => countWords(audioText), [audioText]);

  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const lastWordElRef = useRef<HTMLElement | null>(null);

  // Auto-scroll respects user control: once the reader manually scrolls
  // (wheel, touch, arrow keys, etc.) we stop following the highlight until
  // they've been still for a while. This lets them pause/scroll back without
  // being yanked down to the active word.
  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);

  useEffect(() => {
    const RESUME_IDLE_MS = 4000;

    const markUserScrolling = () => {
      // Ignore the brief programmatic scroll we trigger ourselves.
      if (programmaticScrollRef.current) return;
      userScrollingRef.current = true;
      if (userScrollTimerRef.current !== null) {
        window.clearTimeout(userScrollTimerRef.current);
      }
      userScrollTimerRef.current = window.setTimeout(() => {
        userScrollingRef.current = false;
        userScrollTimerRef.current = null;
      }, RESUME_IDLE_MS);
    };

    // These input events only fire on genuine user interaction, never on
    // programmatic scrollIntoView, so they're a reliable user-intent signal.
    window.addEventListener("wheel", markUserScrolling, { passive: true });
    window.addEventListener("touchmove", markUserScrolling, { passive: true });
    window.addEventListener("touchstart", markUserScrolling, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(e.key)
      ) {
        markUserScrolling();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("wheel", markUserScrolling);
      window.removeEventListener("touchmove", markUserScrolling);
      window.removeEventListener("touchstart", markUserScrolling);
      window.removeEventListener("keydown", onKey);
      if (userScrollTimerRef.current !== null) {
        window.clearTimeout(userScrollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lastWordElRef.current) {
      lastWordElRef.current.classList.remove("blog-word--active");
      lastWordElRef.current = null;
    }
    if (currentWordIdx < 0) return;
    const el = articleRef.current?.querySelector<HTMLElement>(
      `[data-w="${currentWordIdx}"]`,
    );
    if (!el) return;
    el.classList.add("blog-word--active");
    lastWordElRef.current = el;

    // Skip auto-scroll while the user is actively controlling the page.
    if (userScrollingRef.current) return;

    const rect = el.getBoundingClientRect();
    const topMargin = 140;
    const bottomMargin = 180;
    if (
      rect.top < topMargin ||
      rect.bottom > window.innerHeight - bottomMargin
    ) {
      // Flag the upcoming scroll as programmatic so our own scrollIntoView
      // doesn't get mistaken for a user gesture and disable auto-follow.
      programmaticScrollRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 800);
    }
  }, [currentWordIdx]);

  useEffect(() => {
    setCurrentWordIdx(-1);
  }, [view, slug]);

  const headings = useMemo(
    () =>
      activeBlocks
        .map((b, idx) =>
          b.kind === "h2"
            ? { id: `s-${idx}-${slugifyHeading(b.text)}`, text: b.text }
            : null,
        )
        .filter((x): x is { id: string; text: string } => x !== null),
    [activeBlocks],
  );

  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleShare = (network: "twitter" | "linkedin") => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post?.title ?? "");
    const link =
      network === "twitter"
        ? `https://twitter.com/intent/tweet?url=${url}&text=${title}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    window.open(link, "_blank", "noopener,noreferrer,width=600,height=520");
  };

  if (slug && LEGACY_SLUG_REDIRECTS[slug]) {
    return (
      <Redirect to={`/resources/blog/${LEGACY_SLUG_REDIRECTS[slug]}`} replace />
    );
  }

  if (!post || !body || activeBlocks.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <MegaMenu />
        <main className="de-nav-clear pb-20">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Article Not Found
            </h1>
            <p className="text-white/70 mb-8">
              The article you’re looking for doesn’t exist.
            </p>
            <Button asChild className="bg-white text-de-accent hover:bg-white/90">
              <Link href="/resources/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Blog
              </Link>
            </Button>
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    );
  }

  // Skip the first paragraph from the body if we want a drop-cap effect
  let firstParagraphRendered = false;
  // Word counter for live audio highlighting — increments in render order so
  // each spoken word can be located via [data-w="N"].
  const wordCounter = { value: 0 };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Helmet>
        <title>{post.seoTitle}</title>
        <meta name="description" content={post.seoDescription} />
        <meta property="og:title" content={post.seoTitle} />
        <meta property="og:description" content={post.seoDescription} />
        <meta property="og:image" content={post.coverImage} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        author={post.author}
        datePublished={post.date}
        image={post.coverImage}
        url={`/resources/blog/${slug}`}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/resources/blog" },
          { name: post.title, url: `/resources/blog/${slug}` },
        ]}
      />
      <ReadingProgressBar targetRef={articleRef} />
      <MegaMenu />

      {/* Cinematic hero */}
      <section className="relative de-nav-clear pb-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${toWebImageUrl(post.coverImage)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) saturate(1.4)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(179,0,255,0.25), transparent 60%), linear-gradient(180deg, rgba(10,10,10,0.7), #0a0a0a 90%)",
          }}
        />
        <div className="container relative mx-auto px-4 max-w-4xl">
          <nav
            className="flex items-center gap-2 text-sm text-white/50 mb-8"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="hover:text-de-accent-ink transition-colors"
            >
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link
              href="/resources/blog"
              className="hover:text-de-accent-ink transition-colors"
            >
              Blog
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white/70 truncate max-w-[260px]">
              {post.title}
            </span>
          </nav>

          <Link
            href="/resources/blog"
            className="inline-flex items-center text-de-accent-ink hover:text-de-accent-ink mb-8 transition-colors text-sm"
            data-testid="link-back-blog"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to all articles
          </Link>

          <header className="mb-10">
            <Badge className="mb-5 bg-de-raised text-de-accent-ink border-de-hairline backdrop-blur">
              {post.category}
            </Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
              {post.title}
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-8 leading-relaxed max-w-3xl">
              {post.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-6 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-de-raised flex items-center justify-center shadow-[0_0_18px_rgba(179,0,255,0.4)]">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium leading-tight">
                    {post.author}
                  </p>
                  <p className="text-xs text-white/50">
                    Cybersecurity-first managed IT
                  </p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-white/10" />
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Calendar className="h-4 w-4" />
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Clock className="h-4 w-4" />
                {activeReadTime}
              </div>

              {/* Share buttons */}
              <div className="ml-auto flex items-center gap-2">
                <BlogAudioPlayer
                  title={post.title}
                  text={audioText}
                  wordCount={totalWords}
                  onWordChange={setCurrentWordIdx}
                />
                <button
                  onClick={() => handleShare("twitter")}
                  className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-de-hairline hover:bg-de-raised transition-all flex items-center justify-center"
                  aria-label="Share on Twitter"
                  data-testid="button-share-twitter"
                >
                  <Twitter className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleShare("linkedin")}
                  className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-de-hairline hover:bg-de-raised transition-all flex items-center justify-center"
                  aria-label="Share on LinkedIn"
                  data-testid="button-share-linkedin"
                >
                  <Linkedin className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCopyLink}
                  className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-de-hairline hover:bg-de-raised transition-all flex items-center justify-center"
                  aria-label="Copy link"
                  data-testid="button-share-copy"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {hasDualVersion && (
              <div
                role="tablist"
                aria-label="Article version"
                className="mt-8 flex flex-col sm:inline-flex sm:flex-row w-full sm:w-auto gap-1 sm:gap-0 rounded-2xl sm:rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur"
                data-testid="tabs-blog-version"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "overview"}
                  onClick={() => setView("overview")}
                  className={`w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-sm font-medium transition-all text-center ${
                    view === "overview"
                      ? "bg-gradient-to-r  to-fuchsia-500 text-white shadow-[0_0_18px_rgba(179,0,255,0.35)]"
                      : "text-white/60 hover:text-white"
                  }`}
                  data-testid="tab-overview"
                >
                  Overview
                  <span className="ml-2 text-sm opacity-70">
                    {body.overviewReadTime}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "extended"}
                  onClick={() => setView("extended")}
                  className={`w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-sm font-medium transition-all text-center ${
                    view === "extended"
                      ? "bg-gradient-to-r  to-fuchsia-500 text-white shadow-[0_0_18px_rgba(179,0,255,0.35)]"
                      : "text-white/60 hover:text-white"
                  }`}
                  data-testid="tab-extended"
                >
                  Extended Deep Dive
                  <span className="ml-2 text-sm opacity-70">
                    {body.extendedReadTime}
                  </span>
                </button>
              </div>
            )}
          </header>

          {/* Hero image with frame */}
          <div className="relative aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_30px_120px_-30px_rgba(179,0,255,0.5)]">
            <img
              src={toWebImageUrl(post.coverImage)}
              alt={post.title}
              loading="eager"
              decoding="async"
              width={960}
              height={540}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
          </div>
        </div>
      </section>

      <main className="pb-24">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="lg:grid lg:grid-cols-12 lg:gap-12">
            {/* TOC sidebar */}
            {headings.length >= 2 && (
              <aside className="hidden lg:block lg:col-span-3" aria-label="Table of contents">
                <div className="sticky top-28">
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 backdrop-blur-sm shadow-[0_10px_40px_-20px_rgba(179,0,255,0.4)]">
                    <div className="flex items-center gap-2 text-sm font-bold text-white/80 mb-5 uppercase tracking-[0.18em]">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-de-raised border border-de-hairline">
                        <List className="h-3.5 w-3.5 text-de-accent-ink" />
                      </span>
                      In this article
                    </div>
                    {(() => {
                      const activeIdx = headings.findIndex(
                        (h) => h.id === activeHeading,
                      );
                      const progressPct =
                        activeIdx < 0
                          ? 0
                          : ((activeIdx + 1) / headings.length) * 100;
                      return (
                        <nav className="relative" aria-label="Sections">
                          {/* Vertical rail with gradient progress fill */}
                          <span
                            aria-hidden
                            className="absolute left-[10px] top-1 bottom-1 w-px bg-white/10"
                          />
                          <span
                            aria-hidden
                            className="absolute left-[10px] top-1 w-px bg-de-raised transition-all duration-500"
                            style={{
                              height: `max(0px, calc(${progressPct}% - 4px))`,
                            }}
                          />
                          <ul className="space-y-1">
                            {headings.map((h, i) => {
                              const isActive = activeHeading === h.id;
                              const isPast = activeIdx > -1 && i < activeIdx;
                              return (
                                <li key={h.id} className="relative pl-7">
                                  {/* Step dot */}
                                  <span
                                    aria-hidden
                                    className={`absolute left-[3px] top-[11px] w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 flex items-center justify-center text-[0.625rem] font-bold ${
                                      isActive
                                        ? "bg-de-accent border-white/80 scale-110"
                                        : isPast
                                          ? "bg-de-raised border-de-hairline"
                                          : "bg-[#0a0a0a] border-white/25"
                                    }`}
                                  >
                                    {isPast && (
                                      <Check className="h-2 w-2 text-white" strokeWidth={4} />
                                    )}
                                  </span>
                                  <a
                                    href={`#${h.id}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      document.getElementById(h.id)?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                      });
                                    }}
                                    className={`block text-sm leading-snug transition-all rounded-lg px-3 py-2 ${
                                      isActive
                                        ? "bg-de-raised text-white font-medium"
                                        : isPast
                                          ? "text-white/55 hover:text-white"
                                          : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                                    }`}
                                    data-testid={`toc-${h.id}`}
                                  >
                                    <span className="text-xs font-bold opacity-50 mr-2 tabular-nums">
                                      {String(i + 1).padStart(2, "0")}
                                    </span>
                                    {h.text}
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                          {/* Progress meter */}
                          <div className="mt-5 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                              <span>Progress</span>
                              <span className="text-de-accent-ink tabular-nums">
                                {activeIdx < 0 ? 0 : activeIdx + 1}/{headings.length}
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-de-raised transition-all duration-500 rounded-full"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </nav>
                      );
                    })()}
                  </div>
                </div>
              </aside>
            )}

            {/* Article body */}
            <div
              className={
                headings.length >= 2 ? "lg:col-span-9" : "lg:col-span-12 max-w-4xl mx-auto"
              }
            >
              <article
                ref={articleRef}
                className="max-w-[680px] mx-auto"
                data-testid="article-content"
                key={view}
              >
                {activeBlocks.map((block, idx) => {
                  if (block.kind === "h2") {
                    const id = `s-${idx}-${slugifyHeading(block.text)}`;
                    return (
                      <h2
                        key={idx}
                        id={id}
                        className="group scroll-mt-28 text-2xl md:text-[34px] font-bold text-white mt-16 mb-6 leading-[1.15] tracking-tight"
                      >
                        <span className="bg-gradient-to-r from-white bg-clip-text text-transparent">
                          {renderTokens(block.text, wordCounter)}
                        </span>
                        <span
                          aria-hidden
                          className="block mt-3 h-px w-12 bg-de-raised"
                        />
                      </h2>
                    );
                  }
                  if (block.kind === "ul") {
                    return (
                      <ul
                        key={idx}
                        className="my-7 space-y-3.5 text-white/80"
                      >
                        {block.items.map((it, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 leading-[1.75] text-[17px]"
                          >
                            <span className="mt-[10px] inline-block w-1.5 h-1.5 rounded-full bg-de-raised flex-shrink-0" />
                            <span>{renderTokens(it, wordCounter)}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  if (block.kind === "callout") {
                    const tone = block.tone ?? "insight";
                    const toneCfg = {
                      insight: {
                        Icon: Sparkles,
                        ring: "border-de-hairline",
                        bg: " to-fuchsia-600/10",
                        glow: "bg-de-raised",
                        accent: "text-de-accent-ink",
                        chip: "bg-de-raised text-white/80 border-de-hairline",
                        defaultTitle: "Key insight",
                      },
                      warning: {
                        Icon: AlertTriangle,
                        ring: "border-fuchsia-400/50",
                        bg: "from-fuchsia-600/20 ",
                        glow: "bg-fuchsia-500/25",
                        accent: "text-fuchsia-200",
                        chip: "bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-400/40",
                        defaultTitle: "Watch out",
                      },
                      note: {
                        Icon: Info,
                        ring: "border-de-hairline",
                        bg: " ",
                        glow: "bg-de-raised",
                        accent: "text-de-accent-ink",
                        chip: "bg-de-raised text-white/80 border-de-hairline",
                        defaultTitle: "Note",
                      },
                      tip: {
                        Icon: Lightbulb,
                        ring: "border-de-hairline",
                        bg: " ",
                        glow: "bg-de-raised",
                        accent: "text-de-accent-ink",
                        chip: "bg-de-raised text-white/80 border-de-hairline",
                        defaultTitle: "Pro tip",
                      },
                    }[tone];
                    const { Icon } = toneCfg;
                    return (
                      <aside
                        key={idx}
                        className={`relative my-9 rounded-2xl border ${toneCfg.ring} bg-gradient-to-br ${toneCfg.bg} backdrop-blur-sm overflow-hidden`}
                        data-testid={`callout-${tone}`}
                      >
                        <div
                          aria-hidden
                          className={`absolute -top-16 -right-16 w-48 h-48 rounded-full ${toneCfg.glow} blur-3xl pointer-events-none`}
                        />
                        <div className="relative p-6 sm:p-7 flex gap-4">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-xl border ${toneCfg.ring} flex items-center justify-center ${toneCfg.accent} bg-black/30`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`inline-block text-xs font-bold uppercase tracking-[0.14em] mb-2 px-2 py-0.5 rounded-full border ${toneCfg.chip}`}>
                              {renderTokens(block.title ?? toneCfg.defaultTitle, wordCounter)}
                            </span>
                            <p className="text-white/90 text-[16px] leading-[1.7]">
                              {renderTokens(block.text, wordCounter)}
                            </p>
                          </div>
                        </div>
                      </aside>
                    );
                  }
                  if (block.kind === "quote") {
                    return (
                      <figure
                        key={idx}
                        className="relative my-10 pl-6 sm:pl-8 border-l-[3px] border-de-hairline"
                        data-testid="pullquote"
                      >
                        <Quote
                          aria-hidden
                          className="absolute -left-[2px] -top-2 h-5 w-5 text-de-accent-ink bg-[#0a0a0a] px-0.5"
                        />
                        <blockquote className="text-white/90 text-xl sm:text-2xl leading-[1.45] font-serif italic">
                          “{renderTokens(block.text, wordCounter)}”
                        </blockquote>
                        {block.cite && (
                          <figcaption className="mt-3 text-sm text-white/50 not-italic">
                            — {block.cite}
                          </figcaption>
                        )}
                      </figure>
                    );
                  }
                  // ---- paragraph ----
                  // Inline pattern detection so existing posts can opt-in via
                  // markdown-ish prefixes without changing their data shape.
                  const raw = block.text.trim();
                  // Pull-quote: paragraph starting with "> "
                  if (raw.startsWith("> ")) {
                    return (
                      <figure
                        key={idx}
                        className="relative my-10 pl-6 sm:pl-8 border-l-[3px] border-de-hairline"
                        data-testid="pullquote"
                      >
                        <Quote
                          aria-hidden
                          className="absolute -left-[2px] -top-2 h-5 w-5 text-de-accent-ink bg-[#0a0a0a] px-0.5"
                        />
                        <blockquote className="text-white/90 text-xl sm:text-2xl leading-[1.45] font-serif italic">
                          “{renderTokens(raw.slice(2), wordCounter)}”
                        </blockquote>
                      </figure>
                    );
                  }
                  // Callout: paragraph starting with a labeled prefix
                  const calloutMatch = raw.match(
                    /^(Key insight|Insight|Warning|Watch out|Note|Tip|Pro tip):\s*(.+)$/i,
                  );
                  if (calloutMatch) {
                    const label = calloutMatch[1].toLowerCase();
                    const tone: "insight" | "warning" | "note" | "tip" =
                      label.includes("warn") || label.includes("watch")
                        ? "warning"
                        : label.includes("note")
                          ? "note"
                          : label.includes("tip")
                            ? "tip"
                            : "insight";
                    const toneCfg = {
                      insight: {
                        Icon: Sparkles,
                        ring: "border-de-hairline",
                        bg: " to-fuchsia-600/10",
                        glow: "bg-de-raised",
                        accent: "text-de-accent-ink",
                        chip: "bg-de-raised text-white/80 border-de-hairline",
                        title: "Key insight",
                      },
                      warning: {
                        Icon: AlertTriangle,
                        ring: "border-fuchsia-400/50",
                        bg: "from-fuchsia-600/20 ",
                        glow: "bg-fuchsia-500/25",
                        accent: "text-fuchsia-200",
                        chip: "bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-400/40",
                        title: "Watch out",
                      },
                      note: {
                        Icon: Info,
                        ring: "border-de-hairline",
                        bg: " ",
                        glow: "bg-de-raised",
                        accent: "text-de-accent-ink",
                        chip: "bg-de-raised text-white/80 border-de-hairline",
                        title: "Note",
                      },
                      tip: {
                        Icon: Lightbulb,
                        ring: "border-de-hairline",
                        bg: " ",
                        glow: "bg-de-raised",
                        accent: "text-de-accent-ink",
                        chip: "bg-de-raised text-white/80 border-de-hairline",
                        title: "Pro tip",
                      },
                    }[tone];
                    const { Icon } = toneCfg;
                    return (
                      <aside
                        key={idx}
                        className={`relative my-9 rounded-2xl border ${toneCfg.ring} bg-gradient-to-br ${toneCfg.bg} backdrop-blur-sm overflow-hidden`}
                        data-testid={`callout-${tone}`}
                      >
                        <div
                          aria-hidden
                          className={`absolute -top-16 -right-16 w-48 h-48 rounded-full ${toneCfg.glow} blur-3xl pointer-events-none`}
                        />
                        <div className="relative p-6 sm:p-7 flex gap-4">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-xl border ${toneCfg.ring} flex items-center justify-center ${toneCfg.accent} bg-black/30`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`inline-block text-xs font-bold uppercase tracking-[0.14em] mb-2 px-2 py-0.5 rounded-full border ${toneCfg.chip}`}>
                              {renderTokens(toneCfg.title, wordCounter)}
                            </span>
                            <p className="text-white/90 text-[16px] leading-[1.7]">
                              {renderTokens(calloutMatch[2], wordCounter)}
                            </p>
                          </div>
                        </div>
                      </aside>
                    );
                  }
                  // Default paragraph — drop-cap on the first one only
                  const isFirst = !firstParagraphRendered;
                  if (isFirst) firstParagraphRendered = true;
                  return (
                    <p
                      key={idx}
                      className={`text-white/85 text-[18px] leading-[1.85] mb-7 ${
                        isFirst
                          ? "first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-7xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-de-accent-ink"
                          : ""
                      }`}
                    >
                      {renderTokens(block.text, wordCounter)}
                    </p>
                  );
                })}
              </article>

              {/* Bottom CTA */}
              <Card className="mt-14 max-w-3xl border-de-hairline bg-de-raised via-[#0a0a0a] to-fuchsia-600/15 overflow-hidden">
                <CardContent className="p-7 sm:p-9 relative">
                  <div
                    aria-hidden
                    className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-fuchsia-500/15 blur-3xl"
                  />
                  <div className="relative">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                      {body.bottomCta?.headline ??
                        "Ready to put this into practice?"}
                    </h3>
                    <p className="text-white/70 mb-6 leading-relaxed">
                      {body.bottomCta?.body ??
                        "A short Cyber Risk Assessment shows where your environment actually stands and what to do first."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button asChild data-testid="button-blog-assessment">
                        <Link href={body.bottomCta?.primaryHref ?? "/book"}>
                          {body.bottomCta?.primaryLabel ??
                            "Schedule a Cyber Risk Assessment"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      {body.bottomCta?.secondaryLabel &&
                        body.bottomCta?.secondaryHref && (
                          <Button
                            asChild
                            variant="outline"
                            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white hover:border-white/50"
                            data-testid="button-blog-secondary"
                          >
                            <Link href={body.bottomCta.secondaryHref}>
                              {body.bottomCta.secondaryLabel}
                            </Link>
                          </Button>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Author card */}
              <Card className="mt-8 max-w-3xl border-white/10 bg-white/[0.02]">
                <CardContent className="p-6 flex items-start gap-5">
                  <div className="w-14 h-14 flex-shrink-0 rounded-full bg-de-raised flex items-center justify-center shadow-[0_0_20px_rgba(179,0,255,0.35)]">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-1">
                      Written by {post.author}
                    </p>
                    <p className="text-white/60 text-sm leading-relaxed mb-3">
                      Digerati Experts is a cybersecurity-first managed IT
                      partner serving Phoenix, Chandler, and the broader
                      Arizona SMB market — covering ProActive Ecosystem managed
                      IT, Standalone Services, Co-Managed IT, vCIO, and AI
                      governance.
                    </p>
                    <div className="flex items-center gap-3">
                      <Link
                        href="/about"
                        className="text-de-accent-ink hover:text-de-accent-ink text-sm inline-flex items-center"
                      >
                        About Digerati Experts
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                      <span className="text-white/20">•</span>
                      <Link
                        href="/#contact"
                        className="text-de-accent-ink hover:text-de-accent-ink text-sm inline-flex items-center"
                      >
                        Get in touch
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Share footer */}
              <div className="mt-8 max-w-3xl flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 text-white/70">
                  <Share2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Share this article</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare("twitter")}
                    className="border-white/20 bg-transparent text-white/90 hover:text-white hover:bg-de-raised hover:border-de-hairline"
                    data-testid="button-share-twitter-bottom"
                  >
                    <Twitter className="h-4 w-4 mr-2" />
                    Twitter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare("linkedin")}
                    className="border-white/20 bg-transparent text-white/90 hover:text-white hover:bg-de-raised hover:border-de-hairline"
                    data-testid="button-share-linkedin-bottom"
                  >
                    <Linkedin className="h-4 w-4 mr-2" />
                    LinkedIn
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="border-white/20 bg-transparent text-white/90 hover:text-white hover:bg-de-raised hover:border-de-hairline"
                    data-testid="button-share-copy-bottom"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" />
                        Copy link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Related articles */}
          {relatedPosts.length > 0 && (
            <section
              className="mt-20 pt-16 border-t border-white/10"
              data-testid="section-related-articles"
            >
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white">
                    Continue reading
                  </h3>
                  <p className="text-white/50 mt-1 text-sm">
                    More from the Digerati Experts journal
                  </p>
                </div>
                <Link
                  href="/resources/blog"
                  className="hidden sm:inline-flex items-center text-de-accent-ink hover:text-de-accent-ink text-sm font-medium"
                >
                  All articles
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedPosts.map((rp) => (
                  <Link key={rp.slug} href={`/resources/blog/${rp.slug}`}>
                    <Card
                      className="group h-full overflow-hidden border-white/10 bg-white/[0.02] hover:border-de-hairline transition-all cursor-pointer"
                      data-testid={`card-related-${rp.slug}`}
                    >
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <img
                          src={toWebImageUrl(rp.coverImage)}
                          alt={rp.title}
                          loading="lazy"
                          decoding="async"
                          width={960}
                          height={540}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/90 via-transparent to-transparent" />
                        <Badge className="absolute top-3 left-3 bg-black/60 text-white border-white/10 backdrop-blur">
                          {rp.category}
                        </Badge>
                      </div>
                      <CardContent className="p-5">
                        <h4 className="text-base font-semibold text-white mb-2 leading-snug group-hover:text-de-accent-ink transition-colors line-clamp-2">
                          {rp.title}
                        </h4>
                        <p className="text-sm text-white/55 line-clamp-2 mb-4 leading-relaxed">
                          {rp.excerpt}
                        </p>
                        <span className="text-de-accent-ink text-sm inline-flex items-center font-medium">
                          Read article
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
}
