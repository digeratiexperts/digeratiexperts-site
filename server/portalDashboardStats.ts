import type { Express, Request, RequestHandler, Response } from "express";
import type { ZohoBillingService, ZohoInvoice, ZohoSubscription } from "./zoho/zohoBilling";
import type { ZohoDeskService, ZohoTicket } from "./zoho/zohoDesk";
import {
  mapDeskStatus,
  normalizeLocalTicketStatus,
  summarizeTicketStatuses,
  type PortalTicketStatus,
} from "./portalDeskTickets";
import { sendStorageUnavailable } from "./storageUnavailableResponse";

/**
 * GET /api/portal/dashboard (W1, journey 10). Every figure is either an exact
 * total from a validated, complete read, or null. A provider failure, a
 * malformed envelope or a partial page never becomes a zero.
 *
 * Scope is the signed-in user only: the email and user id come from the
 * session (req.user / req.userId). Nothing in the query or body is read.
 */

export type BillingStatus = "ok" | "not_linked" | "unavailable";
export type TicketSource = "desk" | "local" | "unavailable";

export interface DashboardStats {
  openTickets: number | null;
  resolvedTickets: number | null;
  waitingOnClient: number | null;
  activeServices: number | null;
  pendingInvoices: number | null;
  recentTickets: Array<{ id: string; ticketNumber?: string; subject: string; status: PortalTicketStatus; priority?: string; createdAt?: unknown }>;
  services: Array<{ id: string; serviceName: string; status: string; amount?: number; nextBilling?: string; zohoLink: string }>;
  ticketSource: TicketSource;
  billingStatus: BillingStatus;
  /** Back-compat: true when either Desk or Billing returned validated data. */
  zohoConnected: boolean;
}

export interface DashboardDeps {
  zohoConfigured(): boolean;
  desk: Pick<ZohoDeskService, "findContactByEmailStrict" | "listTicketsByContactStrict">;
  billing: Pick<ZohoBillingService, "findCustomerByEmailStrict" | "listInvoicesByCustomerStrict" | "listSubscriptionsByCustomerStrict">;
  localTickets(userId: string): Promise<Array<{ id: unknown; ticketNumber?: string | null; subject?: string | null; status?: string | null; priority?: string | null; createdAt?: unknown }>>;
}

const UNPAID = new Set(["unpaid", "overdue"]);
const LIVE = new Set(["live", "active"]);

function recentFrom(rows: Array<{ id: unknown; ticketNumber?: unknown; subject?: unknown; priority?: unknown; createdAt?: unknown }>, statuses: PortalTicketStatus[]) {
  const out: DashboardStats["recentTickets"] = [];
  for (let i = 0; i < rows.length && out.length < 5; i++) {
    const r = rows[i];
    if (!r || (typeof r.id !== "string" && typeof r.id !== "number")) continue;
    out.push({
      id: String(r.id),
      ticketNumber: typeof r.ticketNumber === "string" ? r.ticketNumber : undefined,
      subject: typeof r.subject === "string" && r.subject ? r.subject : "(no subject)",
      status: statuses[i],
      priority: typeof r.priority === "string" ? r.priority : undefined,
      createdAt: r.createdAt,
    });
  }
  return out;
}

async function loadTickets(deps: DashboardDeps, userId: string, email: string | undefined) {
  const unknown = { openTickets: null, resolvedTickets: null, waitingOnClient: null } as const;
  if (deps.zohoConfigured() && email) {
    const contact = await deps.desk.findContactByEmailStrict(email);
    if (!contact.ok) return { ...unknown, recentTickets: [], ticketSource: "unavailable" as const };
    if (contact.value) {
      const list = await deps.desk.listTicketsByContactStrict(contact.value.id);
      if (!list.ok) return { ...unknown, recentTickets: [], ticketSource: "unavailable" as const };
      const tickets: ZohoTicket[] = list.value.tickets;
      const statuses = tickets.map((t) => mapDeskStatus(t.status, t.statusType));
      const recentTickets = recentFrom(
        tickets.map((t) => ({ id: t.id, ticketNumber: t.ticketNumber, subject: t.subject, priority: t.priority, createdAt: (t as { createdTime?: unknown }).createdTime })),
        statuses,
      );
      // A full page may hide more tickets: no exact totals from it.
      if (!list.value.complete) return { ...unknown, recentTickets, ticketSource: "desk" as const };
      return { ...summarizeTicketStatuses(statuses), recentTickets, ticketSource: "desk" as const };
    }
    // Validated no-match in Desk: the portal's own tickets are the record.
  }
  const rows = (await deps.localTickets(userId)).filter((t) => t && typeof t === "object");
  const statuses = rows.map((t) => normalizeLocalTicketStatus(t.status));
  return {
    ...summarizeTicketStatuses(statuses),
    recentTickets: recentFrom(
      rows.map((t) => ({ ...t, ticketNumber: t.ticketNumber || `#TK${String(t.id).padStart(3, "0")}` })),
      statuses,
    ),
    ticketSource: "local" as const,
  };
}

async function loadBilling(deps: DashboardDeps, email: string | undefined) {
  const none = { pendingInvoices: null, activeServices: null, services: [] as DashboardStats["services"] };
  if (!deps.zohoConfigured() || !email) return { ...none, billingStatus: "not_linked" as const };
  const customer = await deps.billing.findCustomerByEmailStrict(email);
  if (!customer.ok) return { ...none, billingStatus: "unavailable" as const };
  if (!customer.value) return { ...none, billingStatus: "not_linked" as const };
  const id = customer.value.customer_id;
  const [invoices, subscriptions] = await Promise.all([
    deps.billing.listInvoicesByCustomerStrict(id),
    deps.billing.listSubscriptionsByCustomerStrict(id),
  ]);
  const pendingInvoices = invoices.ok
    ? invoices.value.filter((inv: ZohoInvoice) => UNPAID.has(inv.status.toLowerCase())).length
    : null;
  const live = subscriptions.ok ? subscriptions.value.filter((s: ZohoSubscription) => LIVE.has(s.status.toLowerCase())) : null;
  const services: DashboardStats["services"] = (live ?? []).map((sub) => ({
    id: sub.subscription_id,
    serviceName: sub.plan?.name || sub.name || "Subscription",
    status: sub.status,
    amount: typeof sub.amount === "number" ? sub.amount : undefined,
    nextBilling: sub.next_billing_at,
    zohoLink: `https://billing.zoho.com/app#/subscriptions/${encodeURIComponent(sub.subscription_id)}`,
  }));
  return {
    pendingInvoices,
    activeServices: live ? live.length : null,
    services,
    billingStatus: invoices.ok && subscriptions.ok ? ("ok" as const) : ("unavailable" as const),
  };
}

export async function buildDashboardStats(deps: DashboardDeps, user: { id: string; email?: string }): Promise<DashboardStats> {
  const [tickets, billing] = await Promise.all([loadTickets(deps, user.id, user.email), loadBilling(deps, user.email)]);
  return {
    openTickets: tickets.openTickets,
    resolvedTickets: tickets.resolvedTickets,
    waitingOnClient: tickets.waitingOnClient,
    recentTickets: tickets.recentTickets,
    ticketSource: tickets.ticketSource,
    activeServices: billing.activeServices,
    pendingInvoices: billing.pendingInvoices,
    services: billing.services,
    billingStatus: billing.billingStatus,
    zohoConnected: tickets.ticketSource === "desk" || billing.billingStatus === "ok" || billing.activeServices !== null || billing.pendingInvoices !== null,
  };
}

type DashboardRequest = Request & { user?: { email?: string }; userId?: string };

export function registerPortalDashboardRoute(app: Express, auth: RequestHandler, deps: DashboardDeps): void {
  app.get("/api/portal/dashboard", [auth], async (request: Request, res: Response) => {
    const req = request as DashboardRequest;
    try {
      res.set("Cache-Control", "private, no-store");
      res.json(await buildDashboardStats(deps, { id: req.userId || "", email: req.user?.email }));
    } catch (error: unknown) {
      if (sendStorageUnavailable(res, error)) return;
      console.error("[ERROR] Dashboard fetch failed");
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });
}
