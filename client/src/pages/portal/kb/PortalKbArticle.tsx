import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CalendarDays, Check, ChevronRight, Eye, Link2, Star, User } from "lucide-react";
import { PortalLayout } from "../PortalLayout";
import { Callout } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { KbBody } from "@/components/portal/kb/KbRenderer";
import { PortalHelpChat } from "@/components/portal/assist/PortalHelpChat";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { Stars, ago } from "@/components/portal/kb/kbUi";
import { outlineTree, parseKbBody, type KbArticle, type KbArticleSummary, type KbRating } from "@shared/kb";
import { KbDocsLayout } from "@/components/kb/docs/KbDocsLayout";
import { KbSideNav } from "@/components/kb/docs/KbSideNav";
import { KbToc, KbTocInline, useScrollSpy } from "@/components/kb/docs/KbToc";

/** A titled list of article links ("Related", "Most viewed", "Most useful"). */
function LinkList({ id, title, items, empty, meta }: { id: string; title: string; items: KbArticleSummary[]; empty: string; meta: "rating" | "ago" }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="kbd-section-title">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="kbd-link-list">
          {items.map((a) => (
            <li key={a.number}>
              <Link href={`/portal/kb/${a.number}`}>
                <span>{a.title}</span>
                <span className="kbd-meta">{meta === "rating" ? <Stars rating={a.rating} /> : ago(a.revisedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RateArticle({ article, onRated }: { article: KbArticle; onRated: (my: number, rating: KbRating) => void }) {
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const current = article.myRating ?? 0;
  const rate = async (stars: number) => {
    setBusy(true);
    setMsg(null);
    const res = await portalFetch(`/api/portal/kb/${article.number}/rating`, { method: "PUT", body: JSON.stringify({ stars }) });
    setBusy(false);
    if (!res.ok) return setMsg("Couldn't save your rating");
    const body = await res.json();
    onRated(body.myRating, body.rating);
    setMsg("Thanks for the feedback");
  };
  return (
    <div>
      <p id="kb-rate-label" className="text-sm font-medium">
        Was this article helpful?
      </p>
      <div role="radiogroup" aria-labelledby="kb-rate-label" className="mt-1 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onClick={() => void rate(n)}
            className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star className={cn("h-6 w-6", n <= (hover || current) ? "fill-current text-[hsl(var(--primary))]" : "text-muted-foreground")} aria-hidden="true" />
          </button>
        ))}
        {msg && (
          <span className="ml-2 text-xs text-muted-foreground" role="status">
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PortalKbArticle() {
  const [, params] = useRoute("/portal/kb/:number");
  const number = (params?.number ?? "").toUpperCase();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["/api/portal/kb", number],
    queryFn: () => portalGet<{ article: KbArticle }>(`/api/portal/kb/${number}`),
    enabled: Boolean(number),
  });
  const highlights = useQuery({
    queryKey: ["/api/portal/kb/highlights"],
    queryFn: () => portalGet<{ mostViewed: KbArticleSummary[]; mostUseful: KbArticleSummary[] }>("/api/portal/kb/highlights"),
  });
  const [copied, setCopied] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const a = q.data?.article;

  const patch = (p: Partial<KbArticle>) =>
    qc.setQueryData(["/api/portal/kb", number], (old: { article: KbArticle } | undefined) => (old ? { article: { ...old.article, ...p } } : old));

  const toggleSub = async () => {
    if (!a) return;
    setSubBusy(true);
    const res = await portalFetch(`/api/portal/kb/${a.number}/subscription`, { method: "PUT", body: JSON.stringify({ subscribed: !a.subscribed }) });
    setSubBusy(false);
    if (res.ok) patch({ subscribed: !a.subscribed });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/portal/kb/${number}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  // The reader's visible articles: the category tree and "Related" (same query key as the index page).
  const list = useQuery({
    queryKey: ["/api/portal/kb"],
    queryFn: () => portalGet<KbArticleSummary[]>("/api/portal/kb"),
  });
  const all = list.data ?? [];
  const toc = useMemo(() => (a ? outlineTree(parseKbBody(a.body)) : []), [a?.body]);
  const active = useScrollSpy(toc.map((t) => t.id), 96);
  const related = a ? all.filter((x) => x.category === a.category && x.number !== a.number).slice(0, 5) : [];
  const navArticles = all.length ? all : a ? [a] : [];

  return (
    <PortalLayout title={a ? `${a.number} · ${a.title}` : "Knowledge article"} hideHeader width="wide">
      <KbDocsLayout
        resetKey={number}
        nav={<KbSideNav articles={navArticles} current={number} currentCategory={a?.category} idPrefix="kbd-rail" />}
        drawerNav={<KbSideNav articles={navArticles} current={number} currentCategory={a?.category} idPrefix="kbd-drawer" />}
        toc={a ? <KbToc items={toc} active={active} /> : undefined}
        drawerLabel="Browse categories"
      >
        <nav aria-label="Breadcrumb" className="kbd-crumbs">
          <ol>
            <li>
              <Link href="/portal/self-service">Home</Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <li>
              <Link href="/portal/kb">Knowledge Base</Link>
            </li>
            {a && (
              <>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <li>
                  <Link href={`/portal/kb?category=${encodeURIComponent(a.category)}`}>{a.category}</Link>
                </li>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <li aria-current="page">{a.title}</li>
              </>
            )}
          </ol>
        </nav>

        {q.isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : q.isError || !a ? (
          <Callout tone="bad" title="Article not found">
            It may have moved, or it isn't available to your company.{" "}
            <Link href="/portal/kb" className="underline">
              Search the knowledge base
            </Link>
          </Callout>
        ) : (
          <article className="kbd-article" aria-labelledby="kb-title">
            <header>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="pt-num text-sm text-muted-foreground">{a.number}</span>
                <button
                  type="button"
                  onClick={() => void toggleSub()}
                  disabled={subBusy}
                  aria-pressed={a.subscribed}
                  className={cn(
                    "inline-flex min-h-[40px] items-center gap-2 rounded-md border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    a.subscribed ? "pt-link border-current" : "border-border text-foreground hover:bg-accent",
                  )}
                >
                  {a.subscribed ? <BellRing className="h-4 w-4" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
                  {a.subscribed ? "Subscribed" : "Subscribe"}
                </button>
              </div>
              <h1 id="kb-title" className="mt-2 text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2rem]">
                {a.title}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" aria-hidden="true" /> Revised by {a.revisedByName || "Digerati Experts"}
                </span>
                <span aria-hidden="true">•</span>
                <span className="inline-flex items-center gap-1.5" title={new Date(a.revisedAt).toLocaleString()}>
                  <CalendarDays className="h-4 w-4" aria-hidden="true" /> {ago(a.revisedAt)}
                </span>
                <span aria-hidden="true">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" aria-hidden="true" /> {a.views.toLocaleString()} View{a.views === 1 ? "" : "s"}
                </span>
                <span aria-hidden="true">•</span>
                <span>{a.readMinutes} min read</span>
                {a.audience === "company" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">For your company</span>}
              </p>
              <KbTocInline items={toc} active={active} />
            </header>
            <hr className="my-6 border-border" />
            <KbBody body={a.body} />

            <div className="kbd-after">
              <div className="kbd-feedback">
                <RateArticle article={a} onRated={(my, rating) => patch({ myRating: my, rating })} />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="pt-link inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
                  {copied ? "Link copied" : "Copy Permalink"}
                </button>
              </div>
              <LinkList id="kb-related" title={`More in ${a.category}`} items={related} empty="No other articles in this category yet." meta="ago" />
              <div className="grid gap-6 md:grid-cols-2">
                <LinkList id="kb-most-viewed" title="Most Viewed" items={(highlights.data?.mostViewed ?? []).filter((x) => x.number !== number).slice(0, 5)} empty="No views yet." meta="ago" />
                <LinkList id="kb-most-useful" title="Most Useful" items={(highlights.data?.mostUseful ?? []).filter((x) => x.number !== number).slice(0, 5)} empty="No ratings yet. Rate an article to help others." meta="rating" />
              </div>
            </div>
          </article>
        )}
      </KbDocsLayout>
      <PortalHelpChat page={{ kind: "other", title: a ? `${a.number} ${a.title}` : "Knowledge article", pathname: `/portal/kb/${number}` }} />
    </PortalLayout>
  );
}
