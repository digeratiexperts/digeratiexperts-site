import { and, eq } from "drizzle-orm";
import { money } from "@shared/storeCommerce";
import { storeClientPricing } from "@shared/schema";
import { db, dbReady, initPromise } from "./db";

export type ClientPriceEntry = {
  productId: string;
  customPrice: number;
  discountPercent: number;
};

type ClientPricingEnvironment = {
  NODE_ENV?: string;
  PORTAL_ENABLE_DEMO_DATA?: string;
};

type ClientPricingSources = {
  environment: ClientPricingEnvironment;
  databaseAvailable: boolean;
  loadDatabaseRows: (clientId: string) => Promise<ClientPriceEntry[]>;
  loadDemoRows?: (clientId: string) => ClientPriceEntry[];
};

export type StoreClientIdentity = {
  id: string;
  companyName: string;
  serviceType?: string | null;
};

export class StoreClientPricingUnavailableError extends Error {
  constructor() {
    super("Authoritative store client pricing is unavailable");
    this.name = "StoreClientPricingUnavailableError";
  }
}

/**
 * Demo / admin overlay. Runtime resolution may use it only when the explicit
 * nonproduction demo-data flag is enabled. Checkout ignores browser prices.
 */
const demoClientPricing = new Map<string, ClientPriceEntry[]>([
  [
    "client-1",
    [
      { productId: "prod-010", customPrice: 35, discountPercent: 10 },
      { productId: "prod-011", customPrice: 22, discountPercent: 12 },
      { productId: "prod-040", customPrice: 22.5, discountPercent: 10 },
    ],
  ],
  [
    "client-2",
    [
      { productId: "prod-010", customPrice: 32, discountPercent: 18 },
      { productId: "prod-012", customPrice: 5, discountPercent: 17 },
    ],
  ],
  [
    "client-3",
    [
      { productId: "prod-010", customPrice: 37, discountPercent: 5 },
      { productId: "prod-035", customPrice: 160, discountPercent: 9 },
      { productId: "prod-036", customPrice: 200, discountPercent: 11 },
    ],
  ],
  [
    "client-4",
    [
      { productId: "prod-010", customPrice: 36, discountPercent: 8 },
      { productId: "prod-030", customPrice: 179, discountPercent: 10 },
    ],
  ],
  [
    "client-5",
    [
      { productId: "prod-010", customPrice: 34, discountPercent: 13 },
      { productId: "prod-011", customPrice: 20, discountPercent: 20 },
      { productId: "prod-030", customPrice: 169, discountPercent: 15 },
      { productId: "prod-040", customPrice: 20, discountPercent: 20 },
    ],
  ],
]);

export function listDemoClientPricing(clientId: string): ClientPriceEntry[] {
  return [...(demoClientPricing.get(clientId) || [])];
}

export function upsertDemoClientPricing(clientId: string, entry: ClientPriceEntry): ClientPriceEntry {
  const current = listDemoClientPricing(clientId);
  const index = current.findIndex((row) => row.productId === entry.productId);
  if (index >= 0) current[index] = entry;
  else current.push(entry);
  demoClientPricing.set(clientId, current);
  return entry;
}

export function removeDemoClientPricing(clientId: string, productId: string): ClientPriceEntry | undefined {
  const current = listDemoClientPricing(clientId);
  const removed = current.find((row) => row.productId === productId);
  demoClientPricing.set(
    clientId,
    current.filter((row) => row.productId !== productId),
  );
  return removed;
}

async function loadDbClientPricing(clientId: string): Promise<ClientPriceEntry[]> {
  if (!dbReady || !db) throw new StoreClientPricingUnavailableError();
  const rows = await db
    .select()
    .from(storeClientPricing)
    .where(and(eq(storeClientPricing.clientId, clientId), eq(storeClientPricing.isActive, true)));
  return rows
    .map((row: { productId: string; customPrice: string | number; discountPercent?: string | number | null }) => ({
      productId: row.productId,
      customPrice: Number(row.customPrice),
      discountPercent: Number(row.discountPercent || 0),
    }))
    .filter((row: ClientPriceEntry) => Number.isFinite(row.customPrice) && row.customPrice > 0);
}

export function isDemoClientPricingEnabled(
  environment: ClientPricingEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    PORTAL_ENABLE_DEMO_DATA: process.env.PORTAL_ENABLE_DEMO_DATA,
  },
): boolean {
  return (
    environment.NODE_ENV !== "production" &&
    environment.PORTAL_ENABLE_DEMO_DATA?.trim().toLowerCase() === "true"
  );
}

/**
 * Resolve pricing under an explicit environment policy. Production never
 * substitutes demo discounts when its authoritative store is unavailable.
 */
export async function resolveClientPricingRowsFromSources(
  clientId: string | null | undefined,
  sources: ClientPricingSources,
): Promise<ClientPriceEntry[]> {
  if (!clientId) return [];

  const production = sources.environment.NODE_ENV === "production";
  const loadDemoRows = sources.loadDemoRows || listDemoClientPricing;
  const demoRows = () => isDemoClientPricingEnabled(sources.environment) ? loadDemoRows(clientId) : [];

  if (!sources.databaseAvailable) {
    if (production) throw new StoreClientPricingUnavailableError();
    return demoRows();
  }

  try {
    const rows = await sources.loadDatabaseRows(clientId);
    return rows.length ? rows : demoRows();
  } catch (error: any) {
    if (production) {
      console.error("[store-pricing] authoritative database lookup failed", {
        clientId,
        message: error?.message || String(error),
      });
      throw new StoreClientPricingUnavailableError();
    }
    console.warn("[store-pricing] database lookup skipped:", error?.message || error);
    return demoRows();
  }
}

/**
 * Resolve the store tenant from the live authenticated request identity, then
 * require the durable client record to match that exact tenant id.
 */
export async function resolveAuthenticatedStoreClient(
  user: { clientId?: string | null } | null | undefined,
  loadClient: (clientId: string) => Promise<StoreClientIdentity | undefined>,
): Promise<StoreClientIdentity | undefined> {
  const clientId = user?.clientId?.trim();
  if (!clientId) return undefined;
  const client = await loadClient(clientId);
  return client?.id === clientId ? client : undefined;
}

export async function resolveClientPricingRows(clientId: string | null | undefined): Promise<ClientPriceEntry[]> {
  if (!clientId) return [];
  await initPromise;
  return resolveClientPricingRowsFromSources(clientId, {
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORTAL_ENABLE_DEMO_DATA: process.env.PORTAL_ENABLE_DEMO_DATA,
    },
    databaseAvailable: Boolean(dbReady && db),
    loadDatabaseRows: loadDbClientPricing,
  });
}

export function toPriceOverrides(rows: ClientPriceEntry[]): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (const row of rows) {
    const price = money(Number(row.customPrice));
    if (Number.isFinite(price) && price > 0) overrides[row.productId] = price;
  }
  return overrides;
}

/**
 * Honor a server-side client list price only when it is a real discount.
 * Higher or invalid overrides fall back to catalog list price.
 */
export function resolveUnitPrice(listPrice: number, override?: number): number {
  const list = money(listPrice);
  if (override == null) return list;
  const custom = money(Number(override));
  if (!Number.isFinite(custom) || custom <= 0 || custom >= list) return list;
  return custom;
}
