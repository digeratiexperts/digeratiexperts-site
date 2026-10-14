/**
 * Every Zoho product's token health in one place, for /api/health and
 * /api/zoho/connection: connected · degraded · needs_reconnect ·
 * not_configured (· unknown before the first use). Stored state only: this
 * never calls Zoho, so polling it cannot create token-endpoint load.
 */
import type { ZohoProduct, ZohoProductHealth } from "./oauth";
import { zohoClient } from "./zohoClient";
import { zohoBooksTokenHealth } from "../services/zohoBooksTax";
import { zohoPayments } from "../zohoPayments";

export async function zohoProductHealth(): Promise<Record<ZohoProduct, ZohoProductHealth>> {
  const safe = (p: Promise<ZohoProductHealth>) =>
    p.catch((): ZohoProductHealth => ({ configured: false, state: "unknown", source: null }));
  const [crm, desk, books, payments] = await Promise.all([
    safe(zohoClient.crmHealth()),
    safe(zohoClient.deskHealth()),
    safe(zohoBooksTokenHealth()),
    safe(zohoPayments.health()),
  ]);
  return { crm, desk, books, payments };
}

/** The states only (no reasons): safe for the public /api/health map. */
export async function zohoHealthStates(): Promise<Record<ZohoProduct, ZohoProductHealth["state"]>> {
  const all = await zohoProductHealth();
  return {
    crm: all.crm.state,
    desk: all.desk.state,
    books: all.books.state,
    payments: all.payments.state,
  };
}
