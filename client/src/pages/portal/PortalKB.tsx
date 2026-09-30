import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { Search, BookOpen, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portalGet } from "@/lib/portalApi";

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  views: number;
}

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
      <div className="space-y-6">
        {/* Error State */}
        {isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load articles: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

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
                    className="hover:border-[#D3126A]/50 transition-colors cursor-pointer"
                    data-testid={`article-${article.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4 text-[#D3126A] flex-shrink-0" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {article.category}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {article.title}
                          </h3>
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {article.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 ml-4 flex-shrink-0">
                          <Eye className="h-3 w-3" />
                          <span>{article.views}</span>
                        </div>
                      </div>
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
