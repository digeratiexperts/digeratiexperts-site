import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  DoorOpen,
  ExternalLink,
  FileText,
  Info,
  KeyRound,
  Package,
  Plus,
  Receipt,
  Ticket,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout, portalFirstName } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { AccountTeamCard } from "@/components/AccountTeamCard";
import { usePortalAccountTeam } from "@/hooks/usePortalAccountTeam";
import { readPortalUser } from "@/lib/portalRoles";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";
import { Callout, EmptyState, Panel, Priority, StatTile, TicketStatus, GenericStatus } from "@/components/portal/ui";

interface DashboardTicket {
  id: string;
  ticketNumber?: string;
  subject: string;
  status: string;
  priority?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface DashboardService {
  id: string;
  serviceName: string;
  amount?: string | number;
  status?: string;
  zohoLink?: string;
}

interface DashboardStats {
  openTickets: number;
  resolvedTickets: number;
  activeServices: number;
  pendingInvoices: number;
  recentTickets: DashboardTicket[];
  services: DashboardService[];
  zohoConnected?: boolean;
}

type Verdict = { tone: "ok" | "warn" | "bad" | "info"; title: string; detail: string; href?: string; cta?: string };

/**
 * The verdict says only what the data supports. Counts come from
 * /api/portal/dashboard (Zoho Desk and Billing when linked, local tickets
 * otherwise); nothing here is inferred or invented.
 */
export function buildVerdict(stats: DashboardStats | undefined, isError: boolean): Verdict {
  if (isError) {
    return { tone: "warn", title: "We couldn't load your summary.", detail: "Tickets and invoices may still be reachable from the menu. If this keeps happening, call us and we'll check the link.", href: "/portal/tickets", cta: "Open tickets" };
  }
  if (!stats) return { tone: "info", title: "Loading your summary…", detail: "" };
  const waiting = stats.recentTickets.filter((t) => /pending/i.test(t.status)).length;
  const invoices = stats.pendingInvoices;
  if (waiting > 0 || invoices > 0) {
    const parts: string[] = [];
    if (waiting > 0) parts.push(`${waiting} ticket${waiting === 1 ? "" : "s"} waiting for your reply`);
    if (invoices > 0) parts.push(`${invoices} invoice${invoices === 1 ? "" : "s"} pending`);
    return {
      tone: "warn",
      title: `${waiting + invoices} item${waiting + invoices === 1 ? " is" : "s are"} waiting on you.`,
      detail: parts.join(" · ") + ".",
      href: waiting > 0 ? "/portal/tickets?status=pending_client" : "/portal/invoices",
      cta: waiting > 0 ? "Reply now" : "View invoices",
    };
  }
  if (stats.openTickets > 0) {
    return {
      tone: "info",
      title: `${stats.openTickets} open ticket${stats.openTickets === 1 ? " is" : "s are"} with DE engineers.`,
      detail: "Nothing is waiting on you. You'll see a reply here and in your inbox as soon as there is one.",
      href: "/portal/tickets",
      cta: "Track tickets",
    };
  }
  if (stats.zohoConnected === false && stats.activeServices === 0) {
    return {
      tone: "info",
      title: "Nothing is waiting on you.",
      detail: "No open tickets. Billing and service figures appear here once your account is linked to Zoho.",
    };
  }
  return { tone: "ok", title: "Nothing is waiting on you.", detail: "No open tickets and no pending invoices. We're watching your environment." };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export default function PortalDashboard() {
  const portalUser = readPortalUser();
  const isAdmin = portalUser?.role === "admin";
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["/api/portal/dashboard"],
    queryFn: () => portalGet<DashboardStats>("/api/portal/dashboard"),
  });
  const { data: knocks } = useQuery<{
    summary: { total: number; failed: number; bots: number; pageHits: number; success: number };
  }>({
    queryKey: ["/api/portal/admin/login-knocks", 24],
    queryFn: () => portalGet("/api/portal/admin/login-knocks?hours=24"),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const accountTeam = usePortalAccountTeam();
  const verdict = buildVerdict(stats, isError);
  const VerdictIcon = verdict.tone === "ok" ? CheckCircle2 : verdict.tone === "warn" ? AlertTriangle : Info;

  return (
    <PortalLayout
      title={`${greeting()}, ${portalFirstName(portalUser)}`}
      eyebrow={todayLabel.format(new Date())}
      description="Here is what needs you, and what DE is handling."
      actions={
        <>
          <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
            <Link href="/portal/forms">
              <KeyRound aria-hidden="true" />
              Request access
            </Link>
          </Button>
          <Button asChild variant="brand">
            <Link href="/portal/tickets/create" data-testid="button-new-ticket">
              <Plus aria-hidden="true" />
              New ticket
            </Link>
          </Button>
        </>
      }
      titleTestId="text-dashboard-title"
    >
      <div className="space-y-5">
        {/* Verdict: the one loud band on the page. */}
        <section className="pt-verdict flex flex-col gap-3 rounded-xl px-4 py-4 md:flex-row md:items-center md:px-5" data-tone={verdict.tone} aria-live="polite" data-testid="dashboard-verdict">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border pt-ring" aria-hidden="true">
            <VerdictIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <>
                <Skeleton className="h-5 w-64" />
                <Skeleton className="mt-2 h-3.5 w-96 max-w-full" />
              </>
            ) : (
              <>
                <h2 className="font-heading text-[15px] font-semibold md:text-base">{verdict.title}</h2>
                {verdict.detail && <p className="mt-0.5 text-sm text-muted-foreground">{verdict.detail}</p>}
              </>
            )}
          </div>
          {verdict.href && verdict.cta && !isLoading && (
            <Button asChild variant="outline" className="shrink-0 border-border bg-card hover:bg-accent">
              <Link href={verdict.href}>
                {verdict.cta}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          )}
        </section>

        {isAdmin && knocks?.summary && (
          <Callout
            tone={knocks.summary.failed > 0 ? "warn" : "info"}
            title={`Login door, last 24 hours: ${knocks.summary.total} knocks`}
            action={
              <Button asChild size="sm" variant="outline" className="border-border bg-card hover:bg-accent">
                <Link href="/portal/admin/login-knocks">
                  Open alerts
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {knocks.summary.failed} failed · {knocks.summary.bots} bot-likely · {knocks.summary.success} successful
            </span>
          </Callout>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key figures">
          <StatTile label="Open tickets" category="tickets" icon={Ticket} value={stats?.openTickets ?? 0} hint={stats ? (stats.openTickets > 0 ? "with DE engineers" : "none open") : undefined} tone={stats && stats.openTickets > 0 ? "warn" : "neutral"} href="/portal/tickets" loading={isLoading} testId="stat-open-tickets" />
          <StatTile label="Resolved tickets" category="tickets" icon={CheckCircle2} value={stats?.resolvedTickets ?? 0} hint="all time" tone="ok" href="/portal/tickets?status=resolved" loading={isLoading} testId="stat-resolved-tickets" />
          <StatTile label="Active services" category="services" icon={Package} value={stats?.activeServices ?? 0} hint={stats?.zohoConnected === false ? "billing not linked yet" : "subscriptions"} tone={stats?.zohoConnected === false ? "neutral" : "info"} href="/portal/services" loading={isLoading} testId="stat-active-services" />
          <StatTile label="Pending invoices" category="billing" icon={Receipt} value={stats?.pendingInvoices ?? 0} hint={stats ? (stats.pendingInvoices > 0 ? "payment due" : "nothing due") : undefined} tone={stats && stats.pendingInvoices > 0 ? "warn" : "neutral"} href="/portal/invoices" loading={isLoading} testId="stat-pending-invoices" />
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            id="recent-tickets"
            category="tickets"
            icon={Ticket}
            title="Recent tickets"
            description="Your latest ticket activity"
            flush
            actions={
              <Link href="/portal/tickets" className="text-sm font-medium pt-link hover:underline">
                All tickets →
              </Link>
            }
          >
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : stats?.recentTickets && stats.recentTickets.length > 0 ? (
              <ul className="divide-y divide-border">
                {stats.recentTickets.map((ticket) => (
                  <li key={ticket.id} data-testid={`ticket-${ticket.id}`}>
                    <Link href={`/portal/tickets/${ticket.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{ticket.subject}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ticket.ticketNumber}
                          {ticket.updatedAt || ticket.createdAt ? ` · ${formatDeskTimestamp(ticket.updatedAt || ticket.createdAt || "")}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {ticket.priority && <Priority priority={ticket.priority} className="hidden sm:inline-flex" />}
                        <TicketStatus status={ticket.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={Ticket}
                title="No tickets yet"
                description="When you open a ticket it appears here with its status."
                action={
                  <Button asChild size="sm" variant="outline" className="border-border bg-card hover:bg-accent">
                    <Link href="/portal/tickets/create">Open a ticket</Link>
                  </Button>
                }
              />
            )}
          </Panel>

          <div className="space-y-4">
            <Panel
              id="services"
              category="services"
              icon={Package}
              title="Your services"
              description="Currently active"
              flush
              actions={
                <Link href="/portal/services" className="text-sm font-medium pt-link hover:underline">
                  All services →
                </Link>
              }
            >
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : stats?.services && stats.services.length > 0 ? (
                <ul className="divide-y divide-border">
                  {stats.services.map((service) => (
                    <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-5" data-testid={`service-${service.id}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{service.serviceName}</p>
                        {service.amount && <p className="pt-num text-xs text-muted-foreground">${service.amount}/mo</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <GenericStatus status={service.status || "active"} />
                        {service.zohoLink && (
                          <a href={service.zohoLink} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-muted-foreground hover:text-foreground" title="View in Zoho" aria-label={`View ${service.serviceName} in Zoho`} data-testid={`link-zoho-${service.id}`}>
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={Package} title="No active services listed" description={stats?.zohoConnected === false ? "Services show here once billing is linked to your account." : "Your subscriptions appear here."} />
              )}
            </Panel>

            <Panel id="do-something" category="requests" icon={Zap} title="Do something">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { href: "/portal/infrastructure", icon: AlertTriangle, label: "Report an outage", hint: "Phone first if it's urgent" },
                  { href: "/portal/forms", icon: KeyRound, label: "Request access or a device", hint: "Routed for approval" },
                  { href: "/portal/kb", icon: BookOpen, label: "Browse the knowledge base", hint: "Fix it yourself in minutes", testId: "button-view-kb" },
                  { href: "/portal/invoices", icon: FileText, label: "View or pay an invoice", hint: "Zoho Payments", testId: "button-view-invoices" },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <li key={a.href}>
                      <Link href={a.href} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors pt-hover-brand hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={a.testId}>
                        <Icon className="h-4 w-4 shrink-0 pt-cat-ink" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{a.label}</span>
                          <span className="block text-xs text-muted-foreground">{a.hint}</span>
                        </span>
                        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel id="account-team" category="account" icon={Users} title="Your account team">
              <AccountTeamCard team={accountTeam} stacked />
            </Panel>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
