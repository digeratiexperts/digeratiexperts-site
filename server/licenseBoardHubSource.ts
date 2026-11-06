/**
 * Where the licence board reads each company's seats from:
 * LICENSE_BOARD_SOURCE = portal (default) | shadow | hub.
 *
 * Cross-repo review step 6, area 1 (Intelligence-Hub
 * docs/architecture/portal-reads-hub-plan.md). The Hub owns entitlements; the
 * portal moves to reading them in three flag positions, so rollback is a flag
 * flip:
 *
 *   portal  the portal's own tables, exactly as before. The Hub is not called.
 *   shadow  the board still renders from the portal. In the background it reads
 *           the Hub and logs, per company, only the products whose seat counts
 *           differ. Nothing the admin sees changes.
 *   hub     company seats come from the Hub. Any company the Hub cannot answer
 *           for (no hub_account_id, Hub down or refusing, or a Hub product the
 *           portal pool cannot match) falls back to the portal's data, logged.
 *
 * Scope: seats a company holds (total / from DE's pool / to order). DE's pool
 * size, the assignments inside a company (departments, people, devices),
 * vendor links, pushes and kits stay on the portal; the Hub contract does not
 * carry them. Writes (allocate / release) still go to the portal tables until
 * the plan's step 7.
 *
 * Matching: the Hub returns its own productId, not the portal item id, so a
 * Hub product is matched to a portal pool item by kind + vendor + product
 * (case- and whitespace-insensitive). license:import copies these fields
 * verbatim, so they line up; two portal items with the same identity are
 * ambiguous and count as unmatched.
 */
import {
  summarizeCompany,
  type CompanySeatSummary,
  type LicenseAllocation,
  type LicenseAssignment,
  type LicensePoolItem,
} from "@shared/licenseBoard";
import type { HubLicensesProjection } from "./integrations/hubLicensesContract";
import { logger } from "./logger";

export type LicenseBoardSource = "portal" | "shadow" | "hub";

const SOURCES: readonly LicenseBoardSource[] = ["portal", "shadow", "hub"];
let warnedBadValue: string | null = null;

/** Read at call time, so a flag flip only needs a restart and tests can set it. Unknown values read as portal. */
export function licenseBoardSource(raw: string | undefined = process.env.LICENSE_BOARD_SOURCE): LicenseBoardSource {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return "portal";
  if ((SOURCES as readonly string[]).includes(v)) return v as LicenseBoardSource;
  if (warnedBadValue !== v) {
    warnedBadValue = v;
    logger.warn("LICENSE_BOARD_SOURCE not recognised; using portal", { value: raw });
  }
  return "portal";
}

export type FetchHubLicenses = (accountId: string, portalClientId: string) => Promise<HubLicensesProjection | null>;

export type BoardClient = { id: string; hubAccountId?: string | null };

type Counts = { total: number; fromPool: number; toOrder: number };

export type SeatDifference = {
  kind: string;
  vendor: string;
  product: string;
  portal: Counts;
  hub: Counts;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function productIdentity(p: { kind: string; vendor: string; product: string }): string {
  return `${norm(p.kind)}|${norm(p.vendor)}|${norm(p.product)}`;
}

/** Identity → portal item, leaving out identities that more than one item shares. */
function portalItemsByIdentity(items: LicensePoolItem[]): Map<string, LicensePoolItem> {
  const seen = new Map<string, LicensePoolItem | null>();
  for (const item of items) {
    const key = productIdentity(item);
    seen.set(key, seen.has(key) ? null : item);
  }
  const out = new Map<string, LicensePoolItem>();
  for (const [key, item] of Array.from(seen.entries())) if (item) out.set(key, item);
  return out;
}

const zero = (): Counts => ({ total: 0, fromPool: 0, toOrder: 0 });

/**
 * Per-product seat counts on each side for one company, and the products where
 * they differ. Raw seat rows on both sides (an app's one-per-company clamp is a
 * display rule, not a difference).
 */
export function diffCompanySeats(
  clientId: string,
  items: LicensePoolItem[],
  allocations: LicenseAllocation[],
  hub: HubLicensesProjection,
): SeatDifference[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows = new Map<string, SeatDifference>();
  const row = (p: { kind: string; vendor: string; product: string }) => {
    const key = productIdentity(p);
    let r = rows.get(key);
    if (!r) {
      r = { kind: p.kind, vendor: p.vendor, product: p.product, portal: zero(), hub: zero() };
      rows.set(key, r);
    }
    return r;
  };
  for (const a of allocations) {
    if (a.clientId !== clientId) continue;
    const item = byId.get(a.itemId);
    const r = item ? row(item) : row({ kind: "unknown", vendor: "", product: `portal item ${a.itemId}` });
    r.portal.total++;
    if (a.source === "order") r.portal.toOrder++;
    else r.portal.fromPool++;
  }
  for (const h of hub.items) {
    const r = row(h);
    r.hub.total += h.seats.total;
    r.hub.fromPool += h.seats.fromPool;
    r.hub.toOrder += h.seats.toOrder;
  }
  const same = (a: Counts, b: Counts) => a.total === b.total && a.fromPool === b.fromPool && a.toOrder === b.toOrder;
  return Array.from(rows.values()).filter((r) => !same(r.portal, r.hub));
}

/**
 * The Hub's seats as the board's company summary: one synthetic seat row per
 * Hub seat on the matching portal item, then the board's own summarizeCompany
 * (so assigned / free / the app clamp are computed exactly as for portal data).
 * Null when any Hub product cannot be matched to exactly one portal pool item.
 */
export function hubCompanySeats(
  clientId: string,
  items: LicensePoolItem[],
  assignments: LicenseAssignment[],
  hub: HubLicensesProjection,
  appIds: ReadonlySet<string>,
): { seats: CompanySeatSummary[] } | { unmatched: string[] } {
  const byIdentity = portalItemsByIdentity(items);
  const unmatched: string[] = [];
  const synthetic: LicenseAllocation[] = [];
  for (const h of hub.items) {
    const item = byIdentity.get(productIdentity(h));
    if (!item) {
      unmatched.push(`${h.vendor} ${h.product} (hub product ${h.productId})`);
      continue;
    }
    const add = (source: "pool" | "order", n: number) => {
      for (let i = 0; i < n; i++) {
        synthetic.push({ id: `hub:${h.productId}:${source}:${i}`, itemId: item.id, clientId, source, createdAt: hub.generatedAt });
      }
    };
    add("pool", h.seats.fromPool);
    add("order", h.seats.toOrder);
  }
  if (unmatched.length) return { unmatched };
  return { seats: summarizeCompany(clientId, synthetic, assignments, appIds) };
}

const HUB_READ_CONCURRENCY = 4;

async function eachLimited<T, R>(list: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

async function readHub(client: BoardClient, fetchHub: FetchHubLicenses): Promise<HubLicensesProjection | null | "unmapped"> {
  const accountId = (client.hubAccountId || "").trim();
  if (!accountId) return "unmapped";
  try {
    return await fetchHub(accountId, client.id);
  } catch {
    return null;
  }
}

export type CompanySeatInput = {
  client: BoardClient;
  items: LicensePoolItem[];
  /** The portal's seat rows; may hold other companies' rows too (filtered by client id). */
  allocations: LicenseAllocation[];
  assignments: LicenseAssignment[];
  appIds: ReadonlySet<string>;
};

/** Shadow: compare one company and log its differences. Never throws; logs nothing when the two agree. */
export async function shadowCompareCompany(input: CompanySeatInput, fetchHub: FetchHubLicenses): Promise<SeatDifference[] | null> {
  const { client } = input;
  const hub = await readHub(client, fetchHub);
  if (hub === "unmapped") {
    logger.info("license-board shadow: skipped, portal client has no hub_account_id", { clientId: client.id });
    return null;
  }
  if (!hub) {
    logger.warn("license-board shadow: Hub licences not available", { clientId: client.id, accountId: client.hubAccountId });
    return null;
  }
  const differences = diffCompanySeats(client.id, input.items, input.allocations, hub);
  if (differences.length) {
    logger.warn("license-board shadow: seat differences", {
      clientId: client.id,
      accountId: client.hubAccountId,
      differences,
    });
  }
  return differences;
}

/** Fire-and-forget shadow comparison for many companies; the response never waits on it. */
export function shadowCompareCompanies(inputs: CompanySeatInput[], fetchHub: FetchHubLicenses): Promise<void> {
  return eachLimited(inputs, HUB_READ_CONCURRENCY, (i) => shadowCompareCompany(i, fetchHub)).then(
    () => undefined,
    (error) => logger.error("license-board shadow failed", error),
  );
}

/** Hub mode: one company's seats from the Hub, or the portal's when the Hub cannot answer for it. */
export async function hubOrPortalCompanySeats(input: CompanySeatInput, fetchHub: FetchHubLicenses): Promise<CompanySeatSummary[]> {
  const { client, items, allocations, assignments, appIds } = input;
  const portal = () => summarizeCompany(client.id, allocations, assignments, appIds);
  const hub = await readHub(client, fetchHub);
  if (hub === "unmapped") {
    logger.warn("license-board hub: falling back to portal, no hub_account_id", { clientId: client.id });
    return portal();
  }
  if (!hub) {
    logger.warn("license-board hub: falling back to portal, Hub licences not available", { clientId: client.id, accountId: client.hubAccountId });
    return portal();
  }
  const fromHub = hubCompanySeats(client.id, items, assignments, hub, appIds);
  if ("unmatched" in fromHub) {
    logger.warn("license-board hub: falling back to portal, Hub products not on the portal pool", {
      clientId: client.id,
      accountId: client.hubAccountId,
      unmatched: fromHub.unmatched,
    });
    return portal();
  }
  return fromHub.seats;
}

/** Hub mode for the whole board: bounded concurrency, per-company fallback. */
export function hubOrPortalCompanies(inputs: CompanySeatInput[], fetchHub: FetchHubLicenses): Promise<CompanySeatSummary[][]> {
  return eachLimited(inputs, HUB_READ_CONCURRENCY, (i) => hubOrPortalCompanySeats(i, fetchHub));
}
