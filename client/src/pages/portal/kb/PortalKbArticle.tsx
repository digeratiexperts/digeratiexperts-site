import { useState } from "react";
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
import { outline, parseKbBody, type KbArticle, type KbArticleSummary, type KbRating } from "@shared/kb";

function RailList({ id, title, items, empty }: { id: string; title: string; items: KbArticleSummary[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card shadow-sm">
      <h2 id={id} className="border-b border-border px-5 py-4 text-lg font-semibold">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a) => (
            <li key={a.number}>
              <Link href={`/portal/kb/${a.number}`} className="block px-5 py-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="block text-sm text-[hsl(var(--primary))]">{a.title}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {ago(a.revisedAt)} · <Stars rating={a.rating} />
                </span>
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

  const toc = a ? outline(parseKbBody(a.body)) : [];

  return (
    <PortalLayout title={a ? `${a.number} · ${a.title}` : "Knowledge article"} hideHeader width="wide">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link href="/portal/self-service" className="text-[hsl(var(--primary))] hover:underline">
              Home
            </Link>
          </li>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <li>
            <Link href="/portal/kb" className="text-[hsl(var(--primary))] hover:underline">
              Knowledge
            </Link>
          </li>
          {a && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <li>
                <Link href={`/portal/kb?category=${encodeURIComponent(a.category)}`} className="text-[hsl(var(--primary))] hover:underline">
                  {a.category}
                </Link>
              </li>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <li aria-current="page" className="text-foreground">
                {a.title}
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
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
            <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-labelledby="kb-title">
              <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <span className="pt-num text-lg text-foreground">{a.number}</span>
                <button
                  type="button"
                  onClick={() => void toggleSub()}
                  disabled={subBusy}
                  aria-pressed={a.subscribed}
                  className={cn(
                    "inline-flex min-h-[40px] items-center gap-2 rounded-md border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    a.subscribed ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-border text-foreground hover:bg-accent",
                  )}
                >
                  {a.subscribed ? <BellRing className="h-4 w-4" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
                  {a.subscribed ? "Subscribed" : "Subscribe"}
                </button>
              </header>
              <div className="px-5 py-6 sm:px-8">
                <h1 id="kb-title" className="text-2xl font-semibold text-foreground sm:text-[1.75rem]">
                  {a.title}
                </h1>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
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
                  {a.audience === "company" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">For your company</span>}
                </p>
                {toc.length > 2 && (
                  <nav aria-label="On this page" className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
                    <p className="mb-1 font-medium">On this page</p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {toc.map((t) => (
                        <li key={t.id}>
                          <a href={`#${t.id}`} className="text-[hsl(var(--primary))] hover:underline">
                            {t.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
                <hr className="my-5 border-border" />
                <KbBody body={a.body} />
              </div>
              <footer className="flex flex-col gap-4 border-t border-border px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                <RateArticle article={a} onRated={(my, rating) => patch({ myRating: my, rating })} />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-[hsl(var(--primary))] hover:underline sm:self-auto"
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
                  {copied ? "Link copied" : "Copy Permalink"}
                </button>
              </footer>
            </article>
          )}
        </div>
        <aside className="space-y-6" aria-label="More articles">
          <RailList id="kb-most-viewed" title="Most Viewed" items={(highlights.data?.mostViewed ?? []).filter((x) => x.number !== number).slice(0, 5)} empty="No views yet." />
          <RailList id="kb-most-useful" title="Most Useful" items={(highlights.data?.mostUseful ?? []).filter((x) => x.number !== number).slice(0, 5)} empty="No ratings yet. Rate an article to help others." />
        </aside>
      </div>
      <PortalHelpChat page={{ kind: "other", title: a ? `${a.number} ${a.title}` : "Knowledge article", pathname: `/portal/kb/${number}` }} />
    </PortalLayout>
  );
}
