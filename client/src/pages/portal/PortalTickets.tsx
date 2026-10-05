import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Search, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";
import { cn } from "@/lib/utils";
import { Callout, DataTable, EmptyState, Panel, Priority, TicketStatus, Token, type DataColumn } from "@/components/portal/ui";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
  isInternal?: boolean;
}

interface TicketsResponse {
  tickets: Ticket[];
  /** Live Zoho Desk sync state for the company being viewed. */
  desk?: {
    scope: "company" | "all-local" | "own";
    linked?: boolean;
    syncedAt: string | null;
    error: string | null;
  };
}

/** How often the open page re-reads tickets; the server caches Desk for 60s. */
const TICKETS_POLL_MS = 30_000;

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "pending_client", label: "Waiting on you" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function PortalTickets() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    return status && FILTERS.some((f) => f.value === status) ? status : "all";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      navigate("/portal/tickets/create");
    }
  }, [navigate]);

  const { data, isLoading, isError, error } = useQuery<TicketsResponse>({
    queryKey: ["/api/portal/tickets"],
    queryFn: () => portalGet<TicketsResponse>("/api/portal/tickets"),
    refetchInterval: TICKETS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const desk = data?.desk;

  const tickets = data?.tickets || [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length };
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tickets]);

  const filteredTickets = tickets.filter((ticket) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || ticket.subject.toLowerCase().includes(q) || ticket.ticketNumber.toLowerCase().includes(q);
    const matchesFilter = filter === "all" || ticket.status === filter;
    return matchesSearch && matchesFilter;
  });

  const columns: DataColumn<Ticket>[] = [
    {
      key: "ticket",
      header: "Ticket",
      primary: true,
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.subject}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="pt-num">{t.ticketNumber}</span>
            {t.companyName && !t.isInternal && <span>· {t.companyName}</span>}
            {t.isInternal && <Token label="Internal" tone="brand" className="px-1.5 py-0 text-[9px]" />}
          </p>
        </div>
      ),
    },
    { key: "status", header: "Status", primary: true, className: "w-40", cell: (t) => <TicketStatus status={t.status} /> },
    { key: "priority", header: "Priority", primary: true, className: "w-28", cell: (t) => <Priority priority={t.priority} /> },
    { key: "category", header: "Category", hideBelowMd: true, className: "w-40", cell: (t) => <span className="capitalize text-muted-foreground">{t.category || "—"}</span> },
    { key: "created", header: "Opened", className: "w-52 whitespace-nowrap", align: "right", cell: (t) => <span className="pt-num text-muted-foreground">{formatDeskTimestamp(t.createdAt)}</span> },
  ];

  return (
    <PortalLayout
      title="Support Tickets"
      description="Track every request you've raised with DE, reply to engineers, and open new ones."
      actions={
        <Button asChild variant="brand">
          <Link href="/portal/tickets/create" data-testid="button-create-ticket">
            <Plus aria-hidden="true" />
            New ticket
          </Link>
        </Button>
      }
      width="wide"
    >
      <div className="space-y-4">
        {isError && (
          <Callout tone="bad" title="Tickets couldn't be loaded">
            {error instanceof Error ? error.message : "Unknown error"}
          </Callout>
        )}
        {desk?.error && (
          <Callout tone="warn" title="Showing the last synced tickets">
            {desk.error} {desk.syncedAt ? `Last synced ${formatDeskTimestamp(desk.syncedAt)}.` : ""}
          </Callout>
        )}
        {desk?.scope === "company" && desk.linked === false && !desk.error && (
          <Callout tone="info" title="No DE Desk account linked yet">
            This company has no matching account in DE Desk, so only tickets opened in the portal appear here.
          </Callout>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80 lg:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search by subject or ticket number"
              aria-label="Search tickets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-border bg-card pl-9"
              data-testid="input-search"
            />
          </div>
          <div role="group" aria-label="Filter by status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              const count = counts[f.value] ?? 0;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  data-testid={`button-filter-${f.value}`}
                >
                  {f.label}
                  {!isLoading && f.value !== "all" && count > 0 && (
                    <span className={cn("pt-num rounded-full px-1.5 text-[10px]", active ? "bg-white/20" : "bg-muted")}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Panel
          id="tickets-list"
          title={filter === "all" ? "All tickets" : FILTERS.find((f) => f.value === filter)?.label}
          description={
            isLoading
              ? "Loading…"
              : `${filteredTickets.length} ticket${filteredTickets.length === 1 ? "" : "s"}` +
                (desk?.syncedAt && !desk.error ? ` · synced with DE Desk ${formatDeskTimestamp(desk.syncedAt)}` : "")
          }
          flush
        >
          <DataTable<Ticket>
            columns={columns}
            rows={filteredTickets}
            rowKey={(t) => t.id}
            rowHref={(t) => `/portal/tickets/${t.id}`}
            rowTestId={(t) => `ticket-row-${t.id}`}
            loading={isLoading}
            caption="Support tickets"
            empty={
              <EmptyState
                icon={Ticket}
                title={tickets.length === 0 ? "No tickets yet" : "No tickets match"}
                description={tickets.length === 0 ? "Open a ticket and a DE engineer picks it up. Urgent? Call us first." : "Try another status or clear the search."}
                action={
                  tickets.length === 0 ? (
                    <Button asChild variant="brand" size="sm">
                      <Link href="/portal/tickets/create">Open a ticket</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => { setFilter("all"); setSearch(""); }}>
                      Clear filters
                    </Button>
                  )
                }
              />
            }
          />
        </Panel>
      </div>
    </PortalLayout>
  );
}
