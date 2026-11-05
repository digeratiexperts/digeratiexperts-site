import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronRight } from "lucide-react";
import { groupByCategory, type KbNavArticle } from "./kbCategories";
import "./kbDocs.css";

/**
 * Category tree for the article page: every category the reader can see, the
 * current one expanded, the current article marked aria-current="page".
 */
export function KbSideNav({
  articles,
  current,
  currentCategory,
  indexHref = "/portal/kb",
  articleHref = (n: string) => `/portal/kb/${n}`,
  idPrefix = "kbd-side",
}: {
  articles: KbNavArticle[];
  current?: string;
  currentCategory?: string;
  indexHref?: string;
  articleHref?: (number: string) => string;
  /** Keeps ids unique when the tree renders twice (rail and drawer). */
  idPrefix?: string;
}) {
  const groups = groupByCategory(articles);
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentCategory ? [currentCategory] : []));
  useEffect(() => {
    if (currentCategory) setOpen((s) => (s.has(currentCategory) ? s : new Set(s).add(currentCategory)));
  }, [currentCategory]);
  const toggle = (c: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  return (
    <nav aria-label="Knowledge base categories" className="kbd-side">
      <p className="kbd-side-title" aria-hidden="true">
        Categories
      </p>
      <Link href={indexHref} className="kbd-side-home">
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        All articles
      </Link>
      <ul>
        {groups.map((g, gi) => {
          const expanded = open.has(g.category);
          const listId = `${idPrefix}-cat-${gi}`;
          return (
            <li key={g.category}>
              <button type="button" className="kbd-side-cat" aria-expanded={expanded} aria-controls={listId} onClick={() => toggle(g.category)}>
                <ChevronRight className="kbd-chevron" aria-hidden="true" />
                <span>{g.category}</span>
                <span className="kbd-count">
                  {g.articles.length}
                  <span className="sr-only"> articles</span>
                </span>
              </button>
              <ul id={listId} className="kbd-side-articles" hidden={!expanded}>
                {g.articles.map((a) => (
                  <li key={a.number}>
                    <Link href={articleHref(a.number)} aria-current={a.number === current ? "page" : undefined}>
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
