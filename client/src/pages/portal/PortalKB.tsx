import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Stars } from "@/components/portal/kb/kbUi";
import { PortalLayout } from "./PortalLayout";
import { BookOpen, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portalGet } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Panel, Token } from "@/components/portal/ui";
import { KbCard, KbCardGrid, KbHelpHero, KbSearchField, KbStillHaveQuestions, KbToneScope } from "@/components/kb/docs/KbIndexParts";
import { KB_CATEGORY_META, categoryIcon, orderCategories } from "@/components/kb/docs/kbCategories";
import type { KbArticleSummary } from "@shared/kb";

interface KBArticle {
  /** The article number (KB0000001); the article page is /portal/kb/:id. */
  id: string;
  title: string;
  summary?: string;
  category: string;
  tags: string[];
  views: number;
  rating?: { average: number; count: number };
}

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
  );

export default function PortalKB() {
  // ?q= opens the page pre-searched (Self-Service search and article cards link here).
  const [search, setSearch] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "",
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("category"),
  );

  const { data: articles = [], isLoading, isError, error } = useQuery<KBArticle[]>({
    queryKey: ["/api/portal/kb"],
    queryFn: () => portalGet<KBArticle[]>("/api/portal/kb"),
  });

  const highlights = useQuery({
    queryKey: ["/api/portal/kb/highlights"],
    queryFn: () => portalGet<{ mostViewed: KbArticleSummary[]; mostUseful: KbArticleSummary[] }>("/api/portal/kb/highlights"),
  });

  const categories = orderCategories(articles.map((a) => a.category).filter(Boolean));
  const countIn = (c: string) => articles.filter((a) => a.category === c).length;
  const browsing = !search.trim() && !selectedCategory;
  const popular = (highlights.data?.mostViewed ?? []).slice(0, 3);

  // Keep ?q= / ?category= in the address so a filtered view can be shared or reloaded.
  const syncUrl = (q: string, c: string | null) => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (q) u.searchParams.set("q", q);
    else u.searchParams.delete("q");
    if (c) u.searchParams.set("category", c);
    else u.searchParams.delete("category");
    window.history.replaceState(window.history.state, "", u.pathname + u.search);
  };
  const chooseCategory = (c: string | null) => {
    setSelectedCategory(c);
    syncUrl(search, c);
    if (c) window.requestAnimationFrame(() => document.getElementById("kb-articles")?.scrollIntoView({ block: "start" }));
  };
  const onSearch = (q: string) => {
    setSearch(q);
    syncUrl(q, selectedCategory);
  };

  const filteredArticles = articles.filter((article) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      article.title.toLowerCase().includes(q) ||
      (article.summary ?? "").toLowerCase().includes(q) ||
      (article.tags ?? []).some((t) => t.toLowerCase().includes(q));
    const matchesCategory =
      !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <PortalLayout title="Knowledge Base" hideHeader>
      <div className="space-y-8">
        <KbToneScope tone="portal">
          <KbHelpHero eyebrow="Knowledge Base" title="How can we help?" lede="Answers to common questions and how-to guides for the services DE manages for you.">
            <KbSearchField id="kb-search" label="Search articles" placeholder="Search articles…" value={search} onChange={onSearch} testId="input-search-kb" />
          </KbHelpHero>
        </KbToneScope>

        {isError && (
          <Callout tone="bad" title="Articles couldn't be loaded">
            {error instanceof Error ? error.message : "Unknown error"}
          </Callout>
        )}

        {browsing && categories.length > 0 && (
          <KbToneScope tone="portal">
            <section aria-labelledby="kb-cat-title">
              <h2 id="kb-cat-title" className="kbd-block-title">
                Browse by category
              </h2>
              <KbCardGrid cols={4}>
                {categories.map((c) => (
                  <KbCard
                    key={c}
                    icon={categoryIcon(c)}
                    title={c}
                    sub={`${countIn(c)} article${countIn(c) === 1 ? "" : "s"}`}
                    text={KB_CATEGORY_META[c]?.blurb}
                    onSelect={() => chooseCategory(c)}
                    testId={`card-category-${c.toLowerCase().replace(/\s+/g, "-")}`}
                  />
                ))}
              </KbCardGrid>
            </section>
          </KbToneScope>
        )}

        {browsing && popular.length > 0 && (
          <KbToneScope tone="portal">
            <section aria-labelledby="kb-popular-title">
              <h2 id="kb-popular-title" className="kbd-block-title">
                Popular articles
              </h2>
              <KbCardGrid cols={3}>
                {popular.map((a) => (
                  <KbCard key={a.number} icon={categoryIcon(a.category)} title={a.title} sub={a.category} text={a.summary} cta="Read article" href={`/portal/kb/${a.number}`} />
                ))}
              </KbCardGrid>
            </section>
          </KbToneScope>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div role="group" aria-label="Filter by category" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
            <button
              type="button"
              onClick={() => chooseCategory(null)}
              aria-pressed={selectedCategory === null}
              className={chipClass(selectedCategory === null)}
              data-testid="button-category-all"
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => chooseCategory(category)}
                aria-pressed={selectedCategory === category}
                className={chipClass(selectedCategory === category)}
                data-testid={`button-category-${category?.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <Panel
          id="kb-articles"
          title={selectedCategory ?? "All articles"}
          description={isLoading ? "Loading…" : `${filteredArticles.length} article${filteredArticles.length === 1 ? "" : "s"}`}
          flush
        >
          {isLoading ? (
            <div className="divide-y divide-border" aria-busy="true" aria-live="polite">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="ml-auto h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredArticles.length > 0 ? (
            <ul className="divide-y divide-border">
              {filteredArticles.map((article) => (
                <li
                  key={article.id}
                  className="flex items-start justify-between gap-4 px-4 py-3.5 md:px-5"
                  data-testid={`article-${article.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BookOpen className="pt-link h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{article.category}</span>
                    </p>
                    <Link href={`/portal/kb/${article.id}`} className="font-medium text-foreground hover:text-[hsl(var(--primary))] hover:underline">
                      {article.title}
                    </Link>
                    {article.summary && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>}
                    {article.tags && article.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {article.tags.map((tag) => (
                          <Token key={tag} label={tag} tone="neutral" className="normal-case tracking-normal" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                  {article.rating && <Stars rating={article.rating} />}
                  <div className="flex items-center gap-1" title={`${article.views} views`}>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="pt-num">{article.views}</span>
                    <span className="sr-only">views</span>
                  </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={BookOpen}
              title={articles.length === 0 ? "No articles yet" : "No articles found matching your search"}
              description={articles.length === 0 ? "Guides appear here as DE publishes them for your tenant." : "Try another category or clear the search."}
              action={
                articles.length > 0 ? (
                  <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => { chooseCategory(null); onSearch(""); }}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}
        </Panel>

        <KbToneScope tone="portal">
          <KbStillHaveQuestions
            text="If the answer isn't here, open a ticket and a DE technician will help."
            action={
              <Button asChild>
                <Link href="/portal/tickets/create" data-testid="button-kb-submit-ticket">
                  Submit a ticket
                </Link>
              </Button>
            }
          />
        </KbToneScope>
      </div>
    </PortalLayout>
  );
}
