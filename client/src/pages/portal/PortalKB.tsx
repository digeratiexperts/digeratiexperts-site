import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { Search, BookOpen, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portalGet } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Panel, Token } from "@/components/portal/ui";

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  views: number;
}

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
  );

export default function PortalKB() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: articles = [], isLoading, isError, error } = useQuery<KBArticle[]>({
    queryKey: ["/api/portal/kb"],
    queryFn: () => portalGet<KBArticle[]>("/api/portal/kb"),
  });

  const categories = Array.from(new Set(articles.map((a) => a.category).filter(Boolean)));

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = article.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory =
      !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <PortalLayout title="Knowledge Base" description="Answers to common questions and how-to guides for the services DE manages for you.">
      <div className="space-y-4">
        {isError && (
          <Callout tone="bad" title="Articles couldn't be loaded">
            {error instanceof Error ? error.message : "Unknown error"}
          </Callout>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80 lg:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search articles..."
              aria-label="Search articles"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-border bg-card pl-9"
              data-testid="input-search-kb"
            />
          </div>
          <div role="group" aria-label="Filter by category" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
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
                onClick={() => setSelectedCategory(category)}
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
                    <p className="font-medium text-foreground">{article.title}</p>
                    {article.tags && article.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {article.tags.map((tag) => (
                          <Token key={tag} label={tag} tone="neutral" className="normal-case tracking-normal" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={`${article.views} views`}>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="pt-num">{article.views}</span>
                    <span className="sr-only">views</span>
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
                  <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => { setSelectedCategory(null); setSearch(""); }}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}
        </Panel>
      </div>
    </PortalLayout>
  );
}
