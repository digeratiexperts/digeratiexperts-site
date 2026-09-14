import { useMemo, useState } from "react";
import { toWebImageUrl } from "@/lib/webImage";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useSEO } from "@/hooks/useSEO";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Sparkles,
  BookOpen,
  X,
  Mail,
  ChevronRight,
} from "lucide-react";
import { blogs, blogBodies } from "@/data/resourceRegistry";
import ebookCover from "@/assets/images/ebook-defending-digital-realm-cover.webp";

const APPROVED_CATEGORIES = [
  "Cybersecurity",
  "Managed IT",
  "Compliance & Risk",
  "AI & Business Security",
] as const;

const ebookFeature = {
  title: "Defending the Digital Realm",
  excerpt:
    "A cyber risk assessment framework for modern businesses. Identify, analyze, and mitigate risk before downtime forces the conversation.",
  category: "Ebook",
  author: "Digerati Experts",
  date: "2025-01-15",
  readTime: "25 min read",
  image: ebookCover,
  href: "/resources/ebook/defending-digital-realm",
};

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const allPosts = useMemo(
    () =>
      blogs
        .map((b) => ({
          ...b,
          href: `/resources/blog/${b.slug}`,
          readTime: blogBodies[b.slug]?.readTime ?? "5 min read",
          image: toWebImageUrl(b.coverImage),
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allPosts.length };
    for (const cat of APPROVED_CATEGORIES) {
      counts[cat] = allPosts.filter((p) => p.category === cat).length;
    }
    return counts;
  }, [allPosts]);

  const filtered = useMemo(() => {
    let list =
      activeCategory === "All"
        ? allPosts
        : allPosts.filter((p) => p.category === activeCategory);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allPosts, activeCategory, query]);

  const pageTitle =
    activeCategory === "All" ? "All Posts" : activeCategory;

  useSEO({
    title: "The Digerati Journal — Cybersecurity & Managed IT Insights",
    description:
      "The Digerati Journal: cybersecurity-first insights for Arizona small and growing businesses — managed IT, ransomware defense, cyber risk assessments, AI governance, and compliance.",
    canonical: "/resources/blog",
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Helmet>
        <title>The Digerati Journal — Cybersecurity & Managed IT Insights | Digerati Experts</title>
        <meta
          name="description"
          content="The Digerati Journal: cybersecurity-first insights for Arizona small and growing businesses — managed IT, ransomware defense, cyber risk assessments, AI governance, and compliance."
        />
      </Helmet>
      <MegaMenu />

      {/* Branded publication banner */}
      <section
        className="relative de-nav-clear overflow-hidden"
        aria-label="The Digerati Journal masthead"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #050312 0%, #0a0a0a 55%, #151217 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(206,15,181,0.6) 0%, transparent 50%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="container relative mx-auto px-4 max-w-7xl py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-white/70 uppercase mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                A Digerati Experts Publication
              </div>
              <h1 className="font-bold text-white leading-[0.95] tracking-tight">
                <span className="block text-2xl md:text-3xl text-white/80 italic font-light">
                  the
                </span>
                <span className="block text-5xl md:text-7xl lg:text-8xl">
                  Digerati{" "}
                  <span className="text-de-accent-ink">
                    Journal
                  </span>
                </span>
              </h1>
              <p className="mt-4 text-white/70 text-sm md:text-base max-w-xl">
                Cybersecurity-first field notes for Arizona small and growing
                businesses.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSearchOpen((o) => !o)}
                className="group relative w-12 h-12 rounded-full text-white border border-de-hairline backdrop-blur-md transition-all duration-200 flex items-center justify-center bg-gradient-to-b from-white/15 to-white/5 hover:from-white/25 hover:to-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.2),0_8px_24px_-8px_rgba(139,92,246,0.55)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(0,0,0,0.2),0_10px_28px_-6px_rgba(217,70,239,0.6)] active:translate-y-px"
                aria-label={searchOpen ? "Close search" : "Open search"}
                data-testid="button-search-toggle"
              >
                <span className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-full bg-gradient-to-b from-white/30 to-transparent opacity-70" aria-hidden />
                {searchOpen ? (
                  <X className="h-[18px] w-[18px] relative" />
                ) : (
                  <Search className="h-[18px] w-[18px] relative" />
                )}
              </button>
              <Button
                asChild
                className="group relative inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold text-white border border-de-hairline backdrop-blur-md transition-all duration-200 bg-de-raised hover:bg-de-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2),0_10px_28px_-8px_rgb(var(--de-accent-rgb) / 0.35)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2),0_14px_36px_-8px_rgb(var(--de-accent-rgb) / 0.4)] active:translate-y-px"
                data-testid="button-subscribe"
              >
                <Link href="/#contact">
                  <span className="pointer-events-none absolute inset-x-3 top-1 h-1/2 rounded-full bg-gradient-to-b from-white/35 to-transparent opacity-70" aria-hidden />
                  <Mail className="h-4 w-4 relative" />
                  <span className="relative">Subscribe</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Horizontal category nav inside banner */}
        <div className="relative border-t border-white/15 bg-black/20 backdrop-blur-sm">
          <div className="container mx-auto px-4 max-w-7xl">
            <nav
              className="flex items-center gap-1 overflow-x-auto scrollbar-none"
              data-testid="filter-categories"
              aria-label="Article categories"
            >
              {(["All", ...APPROVED_CATEGORIES] as const).map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    data-testid={`button-filter-${cat
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")}`}
                    className={`relative whitespace-nowrap px-5 py-4 text-sm font-medium transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {cat === "All" ? "All Posts" : cat}
                    <span
                      className={`ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? "bg-white text-de-accent"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {categoryCounts[cat]}
                    </span>
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-de-accent-ink to-de-accent-ink rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Expandable search bar */}
        {searchOpen && (
          <div className="relative bg-black/40 backdrop-blur border-t border-white/10">
            <div className="container mx-auto px-4 max-w-7xl py-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles, topics, frameworks…"
                  className="pl-11 pr-11 h-12 bg-white/[0.06] border-white/15 text-white placeholder:text-white/55 focus-visible:ring-de-accent/40 focus-visible:border-de-accent/40 rounded-full"
                  data-testid="input-blog-search"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <main className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Breadcrumb + page title */}
          <div className="flex items-center gap-2 text-sm text-white/55 mb-3">
            <Link href="/" className="hover:text-de-accent-ink transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href="/resources/blog"
              className="hover:text-de-accent-ink transition-colors"
            >
              Journal
            </Link>
            {activeCategory !== "All" && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-white/60">{activeCategory}</span>
              </>
            )}
          </div>
          <div className="flex items-end justify-between gap-4 mb-10 flex-wrap">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              {pageTitle}
            </h2>
            <span className="text-sm text-white/55">
              {filtered.length} {filtered.length === 1 ? "article" : "articles"}
              {query && (
                <>
                  {" "}
                  matching <span className="text-white/70">"{query}"</span>
                </>
              )}
            </span>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div
              className="text-center py-20 rounded-3xl border border-white/10 bg-white/[0.02]"
              data-testid="text-no-posts"
            >
              <Search className="h-10 w-10 mx-auto text-white/55 mb-4" />
              <p className="text-white/70 text-lg mb-2">No matches found</p>
              <p className="text-white/55 text-sm">
                Try a different search or category.
              </p>
              {(query || activeCategory !== "All") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-white/15 text-white/70 hover:text-white hover:border-de-hairline"
                  onClick={() => {
                    setQuery("");
                    setActiveCategory("All");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {/* Magazine grid — equal cards, dense */}
          {filtered.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7">
              {filtered.map((post) => (
                <Link href={post.href} key={post.slug}>
                  <Card
                    className="group h-full overflow-hidden border-white/10 bg-white/[0.02] hover:border-de-accent/40 transition-all cursor-pointer flex flex-col"
                    data-testid={`card-post-${post.slug}`}
                  >
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        loading="lazy"
                        decoding="async"
                        width={500}
                        height={281}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/70 via-transparent to-transparent" />
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-black/60 text-white border-white/15 backdrop-blur uppercase text-xs tracking-wider font-semibold">
                          {post.category}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-6 flex flex-col flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-3 leading-snug group-hover:text-de-accent-ink transition-colors line-clamp-3">
                        {post.title}
                      </h3>
                      <p className="text-white/55 text-sm mb-5 line-clamp-3 flex-1 leading-relaxed">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-white/55 pt-4 border-t border-white/5">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.date).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-white/20">/</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readTime}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Ebook spotlight — editorial bottom feature */}
          <section className="mt-20" aria-label="Featured ebook">
            <div className="rounded-3xl border border-white/10 bg-de-raised overflow-hidden">
              <Link href={ebookFeature.href}>
                <div
                  className="grid md:grid-cols-2 gap-0 group cursor-pointer"
                  data-testid="card-featured-ebook"
                >
                  <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden">
                    <img
                      src={ebookFeature.image}
                      alt={ebookFeature.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0a0a]/40 md:to-[#0a0a0a]/0" />
                  </div>
                  <div className="p-8 md:p-10 flex flex-col justify-center">
                    <Badge className="self-start mb-4 bg-de-raised text-de-accent-ink border-de-hairline">
                      <BookOpen className="h-3 w-3 mr-1.5" />
                      Free Ebook
                    </Badge>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 group-hover:text-de-accent-ink transition-colors">
                      {ebookFeature.title}
                    </h3>
                    <p className="text-white/65 text-base mb-6 leading-relaxed">
                      {ebookFeature.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-white/50 mb-6">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {ebookFeature.readTime}
                      </span>
                      <span>•</span>
                      <span>{ebookFeature.author}</span>
                    </div>
                    <span className="inline-flex items-center text-de-accent-ink font-medium">
                      Read the ebook
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="mt-16">
            <Card className="overflow-hidden border-de-hairline bg-de-raised ">
              <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    Want a tailored recommendation?
                  </h3>
                  <p className="text-white/70 max-w-xl">
                    A short Cyber Risk Assessment shows where your environment
                    actually stands and what to do first.
                  </p>
                </div>
                <Button
                  asChild
                  className="group relative inline-flex items-center gap-3 h-14 px-8 rounded-2xl font-semibold text-white whitespace-nowrap border border-de-hairline backdrop-blur-md transition-all duration-200 bg-de-raised hover:bg-de-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(0,0,0,0.25),0_14px_36px_-10px_rgb(var(--de-accent-rgb) / 0.4)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.25),0_18px_44px_-10px_rgb(var(--de-accent-rgb) / 0.45)] active:translate-y-px"
                  data-testid="button-blog-assessment"
                >
                  <Link href="/book">
                    <span className="pointer-events-none absolute inset-x-4 top-1 h-1/2 rounded-2xl bg-gradient-to-b from-white/35 to-transparent opacity-70" aria-hidden />
                    <span className="relative">Schedule a Cyber Risk Assessment</span>
                    <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
}
