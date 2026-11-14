import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { Search, BookOpen, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portalGet } from "@/lib/portalApi";

interface KBArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  excerpt?: string;
  readTime?: string;
  updatedAt?: string;
}

export default function PortalKB() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

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
    <PortalLayout title="Knowledge Base">
      <div className="space-y-6">
        {/* Error State */}
        {isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load articles: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Knowledge Base</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Find answers to common questions and learn how to use our services
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
            data-testid="input-search-kb"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant={selectedCategory === null ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      selectedCategory === null
                        ? "bg-[#D3126A] hover:bg-[#D3126A]/90"
                        : ""
                    }`}
                    onClick={() => setSelectedCategory(null)}
                    data-testid="button-category-all"
                  >
                    All Categories
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={
                        selectedCategory === category ? "default" : "ghost"
                      }
                      className={`w-full justify-start ${
                        selectedCategory === category
                          ? "bg-[#D3126A] hover:bg-[#D3126A]/90"
                          : ""
                      }`}
                      onClick={() => setSelectedCategory(category)}
                      data-testid={`button-category-${category?.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Articles Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : filteredArticles.length > 0 ? (
              <div className="space-y-4">
                {filteredArticles.map((article) => (
                  <Card
                    key={article.id}
                    className="overflow-hidden transition-colors hover:border-[#D3126A]/50"
                    data-testid={`article-${article.id}`}
                  >
                    <CardContent className="p-0">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-4 p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D3126A]"
                        onClick={() => setExpandedArticleId((current) => current === article.id ? null : article.id)}
                        aria-expanded={expandedArticleId === article.id}
                        data-testid={`button-article-${article.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4 text-[#D3126A] flex-shrink-0" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {article.category}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {article.title}
                          </h3>
                          {article.excerpt && (
                            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                              {article.excerpt}
                            </p>
                          )}
                          {article.readTime && (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {article.readTime}
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          className={`mt-1 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${expandedArticleId === article.id ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                      {expandedArticleId === article.id && (
                        <div className="border-t border-gray-100 bg-gray-50 px-6 py-5 text-sm leading-relaxed text-gray-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-gray-200">
                          <p>{article.content}</p>
                          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                            Need help applying this guidance? Open a support ticket so the service team can verify it for your environment.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No articles found matching your search
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
