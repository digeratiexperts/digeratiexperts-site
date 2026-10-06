import { useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Headset,
  Heart,
  KeyRound,
  Laptop,
  LayoutGrid,
  ListTodo,
  MessageSquareHeart,
  Monitor,
  RotateCcw,
  Search,
  Server,
  ShoppingCart,
  SquarePen,
  UserPlus,
  Wrench,
} from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { usePortalSession } from "@/components/portal/shell/portalSession";
import { canApprovals } from "@/lib/portalRoles";
import { portalGet } from "@/lib/portalApi";
import { srApi } from "@/lib/serviceRequestsApi";
import { cn } from "@/lib/utils";
import { PortalHelpChat } from "@/components/portal/assist/PortalHelpChat";
import { useRequestContext } from "@/components/portal/requests/RequestCommon";
import { CATALOG_ITEMS, searchCatalog, type CatalogItem } from "@/components/portal/requests/catalog";
import { useFavorites } from "@/components/portal/requests/favorites";
import { BASKET_STATUS, TERMINAL_STATUSES } from "@shared/serviceRequests";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { builtInAnnouncements, type PortalAnnouncement } from "@shared/portalAnnouncements";
import { todayIso } from "@shared/serviceRequests";
import { AnnouncementCarousel } from "@/components/portal/selfservice/AnnouncementCarousel";

/**
 * Self-Service home (/portal/self-service): one page to start anything —
 * greeting, My workspace counts, "How can we help?" search, the four
 * self-service doors, recommended requests, latest articles, favourites,
 * quick links, the service desk phone, feedback and the Ask DE chat. Every
 * count and list comes from an existing scoped portal endpoint; nothing here
 * is sample data.
 */

type KBArticle = { id: string; title: string; category: string; excerpt: string; updatedAt: string; readTime?: string };
type Ticket = { id: string; status: string };

const ICONS: Record<CatalogItem["icon"], ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  return: RotateCcw,
  key: KeyRound,
  monitor: Monitor,
  "user-plus": UserPlus,
  wrench: Wrench,
  server: Server,
  cart: ShoppingCart,
};

const OPEN_TICKET = new Set(["open", "new", "in_progress", "in progress", "pending", "pending_client", "on_hold", "escalated"]);
const WAITING_ON_YOU = new Set(["pending", "pending_client"]);

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Card({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      {children}
    </section>
  );
}

function WorkspaceRow({
  icon: Icon,
  label,
  count,
  href,
  loading,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  count: number | null;
  href: string;
  loading?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[52px] items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
        <span className="pt-num text-sm font-semibold text-[hsl(var(--primary))]" aria-label={`${count ?? 0} ${label}`}>
          {loading ? "…" : count != null && count > 9 ? "9+" : (count ?? 0)}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

function FavoriteButton({ id, label }: { id: string; label: string }) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-pressed={on}
      aria-label={on ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[hsl(var(--primary))] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Heart className={cn("h-4 w-4", on && "fill-current")} aria-hidden="true" />
    </button>
  );
}

/** Horizontal card rail with previous / next buttons, like the reference carousels. */
function Rail({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <Card labelledBy={id} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id={id} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`Scroll ${title} back`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`Scroll ${title} forward`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div ref={ref} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth p-5 [scrollbar-width:thin]" role="list">
        {children}
      </div>
    </Card>
  );
}

const DOORS = [
  {
    title: "Digital IT shop",
    body: "Browse and order approved devices, accessories, and software for your work needs.",
    href: "/portal/procurement",
    Icon: ShoppingCart,
    accent: "rgb(var(--pt-ok))",
  },
  {
    title: "Request Services",
    body: "Submit requests for new accounts, system access, equipment, or specialized IT support.",
    href: "/portal/requests",
    Icon: Monitor,
    accent: "rgb(var(--pt-warn))",
  },
  {
    title: "Fix your issue",
    body: "Report problems with hardware, applications, or connectivity and track resolution.",
    href: "/portal/tickets/create",
    Icon: Wrench,
    accent: "rgb(var(--pt-bad))",
  },
  {
    title: "Find your solution",
    body: "Search our knowledge base for guides, FAQs, and troubleshooting steps to solve issues yourself.",
    href: "/portal/kb",
    Icon: BookOpen,
    accent: "rgb(var(--pt-info))",
  },
];

const QUICK_LINKS = [
  { label: "Knowledge Base", href: "/portal/kb" },
  { label: "My Service Requests", href: "/portal/requests" },
  { label: "Request Forms", href: "/portal/forms" },
  { label: "Support Tickets", href: "/portal/tickets" },
  { label: "Service Status", href: "/portal/status" },
];

export default function PortalSelfService() {
  const { user } = usePortalSession();
  const [, navigate] = useLocation();
  const { context, basketCount } = useRequestContext();
  const { favorites, isFavorite } = useFavorites();
  const me = context.data?.me ?? null;
  const approvalsAllowed = canApprovals(user);

  const requests = useQuery({ queryKey: ["/api/portal/service-requests"], queryFn: srApi.list });
  const tickets = useQuery({
    queryKey: ["/api/portal/tickets"],
    queryFn: () => portalGet<{ tickets: Ticket[] } | Ticket[]>("/api/portal/tickets"),
  });
  const approvals = useQuery({
    queryKey: ["/api/portal/approvals", "mine"],
    queryFn: () => portalGet<{ approvals: Array<{ status: string }> }>("/api/portal/approvals?scope=mine"),
    enabled: approvalsAllowed,
  });
  const assets = useQuery({
    queryKey: ["/api/portal/service-requests/assets", me?.userId],
    queryFn: () => srApi.assets(me!.userId),
    enabled: Boolean(me?.userId),
  });
  const kb = useQuery({ queryKey: ["/api/portal/kb"], queryFn: () => portalGet<KBArticle[]>("/api/portal/kb") });
  const announcements = useQuery({
    queryKey: ["/api/portal/self-service/announcements"],
    queryFn: () => portalGet<{ announcements: PortalAnnouncement[] }>("/api/portal/self-service/announcements"),
    staleTime: 5 * 60_000,
  });
  // The built-in DE slides show while loading or if the endpoint fails, so the carousel is never empty.
  const slides = announcements.data?.announcements?.length ? announcements.data.announcements : builtInAnnouncements(todayIso());

  const ticketList: Ticket[] = Array.isArray(tickets.data) ? tickets.data : tickets.data?.tickets ?? [];
  const openRequests = (requests.data?.requests ?? []).filter(
    (r) => r.status !== BASKET_STATUS && !TERMINAL_STATUSES.includes(r.status),
  ).length;
  const openTickets = ticketList.filter((t) => OPEN_TICKET.has(String(t.status).toLowerCase())).length;
  const waiting = ticketList.filter((t) => WAITING_ON_YOU.has(String(t.status).toLowerCase())).length;
  const pendingApprovals = (approvals.data?.approvals ?? []).filter((a) => String(a.status).toLowerCase() === "pending").length;
  const articles = useMemo(
    () => [...(kb.data ?? [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    [kb.data],
  );

  // Search: catalog items and articles, as a listbox under the field.
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const catalogHits = searchCatalog(q).slice(0, 5);
  const articleHits = q.trim()
    ? articles.filter((a) => `${a.title} ${a.excerpt} ${a.category}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4)
    : [];
  const hits: Array<{ key: string; label: string; detail: string; href: string }> = [
    ...catalogHits.map((c) => ({ key: c.id, label: c.title, detail: "Request", href: c.href })),
    ...articleHits.map((a) => ({ key: `kb:${a.id}`, label: a.title, detail: "Article", href: `/portal/kb?q=${encodeURIComponent(a.title)}` })),
  ];
  const go = (href: string) => {
    setQ("");
    navigate(href);
  };
  const submitSearch = () => {
    if (hits[active]) go(hits[active].href);
    else if (q.trim()) go(`/portal/kb?q=${encodeURIComponent(q.trim())}`);
  };
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setQ("");
    }
  };

  const favoriteItems = favorites
    .map((id) => {
      if (id.startsWith("kb:")) {
        const a = articles.find((x) => `kb:${x.id}` === id);
        return a ? { id, label: a.title, href: `/portal/kb?q=${encodeURIComponent(a.title)}`, kind: "Article" } : null;
      }
      const c = CATALOG_ITEMS.find((x) => x.id === id);
      return c ? { id, label: c.title, href: c.href, kind: "Request" } : null;
    })
    .filter(Boolean) as Array<{ id: string; label: string; href: string; kind: string }>;

  // Recommended: favourites first, then the rest of the catalog in its order.
  const recommended = [...CATALOG_ITEMS].sort((a, b) => Number(isFavorite(b.id)) - Number(isFavorite(a.id)));

  const first = (me?.name || user?.fullName || "").split(" ")[0];

  return (
    <PortalLayout title="Self-Service" hideHeader width="wide">
      <div className="space-y-6 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {greeting()}
            {first ? `, ${first}` : ""}!
          </h1>
          <Link
            href="/portal/requests/basket"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Cart{basketCount > 0 ? ` (${basketCount})` : ""}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          {/* Left column */}
          <div className="order-2 space-y-6 lg:order-1">
            <Card labelledBy="ss-workspace">
              <h2 id="ss-workspace" className="border-b border-border px-5 py-4 text-lg font-semibold text-foreground">
                My workspace
              </h2>
              <ul>
                <WorkspaceRow icon={ListTodo} label="Actions" count={waiting} href="/portal/tickets" loading={tickets.isLoading} />
                <WorkspaceRow icon={SquarePen} label="Requests" count={openRequests} href="/portal/requests" loading={requests.isLoading} />
                <WorkspaceRow icon={LayoutGrid} label="Incidents" count={openTickets} href="/portal/tickets" loading={tickets.isLoading} />
                <WorkspaceRow icon={Wrench} label="Assets" count={assets.data?.assets.length ?? 0} href="/portal/requests/return-computer" loading={assets.isLoading} />
                {approvalsAllowed && (
                  <WorkspaceRow icon={ClipboardCheck} label="Approvals" count={pendingApprovals} href="/portal/approvals" loading={approvals.isLoading} />
                )}
                <WorkspaceRow icon={ShoppingCart} label="Cart" count={basketCount} href="/portal/requests/basket" />
              </ul>
            </Card>

            <Card labelledBy="ss-favorites" className="p-5">
              <h2 id="ss-favorites" className="sr-only">
                Favourites
              </h2>
              {favoriteItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <Heart className="h-10 w-10 fill-current text-[hsl(var(--primary)/0.7)]" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">You haven't favorited anything yet</p>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-sm font-semibold text-foreground" aria-hidden="true">
                    Favourites
                  </p>
                  <ul className="space-y-1">
                    {favoriteItems.map((f) => (
                      <li key={f.id} className="flex items-center gap-2">
                        <Heart className="h-3.5 w-3.5 shrink-0 fill-current text-[hsl(var(--primary))]" aria-hidden="true" />
                        <Link href={f.href} className="min-w-0 flex-1 truncate text-sm text-[hsl(var(--primary))] hover:underline">
                          {f.label}
                        </Link>
                        <span className="text-xs text-muted-foreground">{f.kind}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card labelledBy="ss-quick-links">
              <h2 id="ss-quick-links" className="border-b border-border px-5 py-4 text-lg font-semibold text-foreground">
                Quick Links
              </h2>
              <ul className="space-y-1 p-3">
                {QUICK_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="flex min-h-[40px] items-center justify-between rounded-md px-2 text-sm text-[hsl(var(--primary))] underline-offset-2 hover:bg-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {l.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <a
              href={PRIMARY_PHONE.telHref}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Headset className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-base font-semibold text-foreground">Phone IT Service Desk</span>
                <span className="pt-num block text-sm text-muted-foreground">{PRIMARY_PHONE.display}</span>
              </span>
            </a>

            <Card labelledBy="ss-feedback" className="p-5">
              <h2 id="ss-feedback" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <MessageSquareHeart className="h-6 w-6 text-[hsl(var(--primary))]" aria-hidden="true" />
                Provide Feedback
              </h2>
              <Link
                href="/portal/surveys"
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Let's get started
              </Link>
            </Card>
          </div>

          {/* Right column */}
          <div className="order-1 min-w-0 space-y-6 lg:order-2">
            <Card labelledBy="ss-help" className="p-5">
              <h2 id="ss-help" className="mb-3 text-xl font-semibold text-foreground">
                How can we help?
              </h2>
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSearch();
                }}
                className="relative"
              >
                <label htmlFor="ss-search" className="sr-only">
                  Search requests and articles
                </label>
                <div className="flex">
                  <input
                    id="ss-search"
                    type="search"
                    value={q}
                    autoComplete="off"
                    placeholder="How can we help?"
                    onChange={(e) => {
                      setQ(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onSearchKey}
                    role="combobox"
                    aria-expanded={hits.length > 0}
                    aria-controls="ss-search-results"
                    aria-activedescendant={hits[active] ? `ss-hit-${hits[active].key}` : undefined}
                    className="min-h-[48px] w-full rounded-l-md border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    className="inline-flex min-w-[56px] items-center justify-center rounded-r-md border border-l-0 border-input bg-card text-[hsl(var(--primary))] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Search className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                {q.trim() && (
                  <ul
                    id="ss-search-results"
                    role="listbox"
                    className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
                  >
                    {hits.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground" role="option" aria-selected="false">
                        No matches. Press Enter to search the knowledge base.
                      </li>
                    ) : (
                      hits.map((h, i) => (
                        <li
                          key={h.key}
                          id={`ss-hit-${h.key}`}
                          role="option"
                          aria-selected={i === active}
                          onMouseEnter={() => setActive(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            go(h.href);
                          }}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded px-3 py-2 text-sm",
                            i === active ? "bg-accent text-foreground" : "text-foreground",
                          )}
                        >
                          <span className="min-w-0 truncate">{h.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{h.detail}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </form>
            </Card>

            <AnnouncementCarousel slides={slides} />

            <Card labelledBy="ss-doors" className="p-5">
              <h2 id="ss-doors" className="mb-4 text-lg font-semibold text-foreground">
                Explore our Self-service options
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {DOORS.map(({ title, body, href, Icon, accent }) => (
                  <li key={title}>
                    <Link
                      href={href}
                      className="group flex h-full flex-col items-center rounded-lg border border-border bg-card px-4 pb-5 pt-6 text-center shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ borderTop: `4px solid ${accent}` }}
                    >
                      <Icon className="h-14 w-14 transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" style={{ color: accent }} />
                      <span className="mt-3 text-lg font-semibold leading-tight text-foreground">{title}</span>
                      <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Rail id="ss-recommended" title="Recommended for you">
              {recommended.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <div key={item.id} role="listitem" className="w-[260px] shrink-0 snap-start sm:w-[300px]">
                    <Link
                      href={item.href}
                      className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Request
                        </span>
                        <FavoriteButton id={item.id} label={item.title} />
                      </span>
                      <span className="mt-2 flex gap-4">
                        <Icon className="h-14 w-14 shrink-0 text-foreground/80" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-semibold text-foreground">{item.title}</span>
                          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{item.blurb}</span>
                        </span>
                      </span>
                    </Link>
                  </div>
                );
              })}
            </Rail>

            <Rail id="ss-articles" title="Latest Articles">
              {kb.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : articles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No articles yet.</p>
              ) : (
                articles.slice(0, 10).map((a) => (
                  <div key={a.id} role="listitem" className="w-[260px] shrink-0 snap-start sm:w-[300px]">
                    <Link
                      href={`/portal/kb?q=${encodeURIComponent(a.title)}`}
                      className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Article
                        </span>
                        <FavoriteButton id={`kb:${a.id}`} label={a.title} />
                      </span>
                      <span className="mt-2 block font-semibold text-foreground">{a.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{a.excerpt}</span>
                      <span className="mt-auto pt-3 text-xs text-muted-foreground">
                        {a.category}
                        {a.readTime ? ` · ${a.readTime}` : ""} · updated {new Date(a.updatedAt).toLocaleDateString()}
                      </span>
                    </Link>
                  </div>
                ))
              )}
            </Rail>
          </div>
        </div>
      </div>
      <PortalHelpChat page={{ kind: "other", title: "Self-Service", pathname: "/portal/self-service" }} />
    </PortalLayout>
  );
}
