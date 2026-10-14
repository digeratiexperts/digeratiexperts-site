/**
 * Zoho OAuth for the website: one token manager per product (CRM, Desk,
 * Books, Payments), all backed by the same store and sharing in-memory state
 * per refresh token. Inventory and runbook: docs/ZOHO-OAUTH-INVENTORY.md.
 */
import { ResilientZohoTokenStore } from "./db-store";
import {
  isZohoConnectEnabled,
  resetZohoRuntimeForTests,
  UNIFIED_PROVIDER,
  ZohoProductAuth,
  type ZohoProductAuthConfig,
  type ZohoProductAuthDeps,
} from "./manager";
import { scopesCover, ZOHO_PRODUCT_SCOPES, type ZohoProduct } from "./scopes";
import type { ZohoTokenStore } from "./store";

export * from "./dc";
export * from "./manager";
export * from "./scopes";
export * from "./store";
export * from "./token-endpoint";
export * from "./connect";

let store: ResilientZohoTokenStore | null = null;

export function zohoTokenStore(): ZohoTokenStore {
  store ??= new ResilientZohoTokenStore();
  return store;
}

/** Logs carry error codes and env var names only, never a token or secret. */
export function zohoOAuthLog(level: "info" | "warn", msg: string, meta?: Record<string, unknown>): void {
  (level === "warn" ? console.warn : console.log)(msg, meta ?? {});
}

export const zohoOAuthDeps: ZohoProductAuthDeps = {
  get store() {
    return zohoTokenStore();
  },
  log: zohoOAuthLog,
};

const registry: ZohoProductAuth[] = [];

/** Create the auth manager for one long-lived product module. */
export function createZohoProductAuth(config: ZohoProductAuthConfig): ZohoProductAuth {
  const auth = new ZohoProductAuth(config, zohoOAuthDeps);
  registry.push(auth);
  return auth;
}

/** Reset cached sources/probes in every product (after Zoho Connect saves a grant). */
export function resetAllZohoProductCaches(): void {
  for (const a of registry) a.resetCaches();
}

// ---- synchronous "is there a Connect grant for X" (for isConfigured()) ----

let connectSnapshot: { scope: string | null; usable: boolean } | null = null;

/**
 * Re-read the Connect grant for the synchronous isConfigured() checks. Called
 * at boot and after connect/disconnect. Never throws.
 */
export async function refreshZohoConnectSnapshot(): Promise<void> {
  try {
    const row = await zohoTokenStore().read(UNIFIED_PROVIDER);
    connectSnapshot = row
      ? { scope: row.scope, usable: row.authStatus !== "revoked" && row.authStatus !== "client_error" }
      : null;
  } catch {
    connectSnapshot = null;
  }
}

/** True when Zoho Connect is on and its stored grant covers `product`. */
export function zohoConnectCovers(product: ZohoProduct): boolean {
  return (
    isZohoConnectEnabled() &&
    !!connectSnapshot &&
    connectSnapshot.usable &&
    scopesCover(connectSnapshot.scope, ZOHO_PRODUCT_SCOPES[product])
  );
}

/** Test hook: forget runtime state, the memory store and the snapshot. */
export function resetZohoOAuthForTests(): void {
  resetZohoRuntimeForTests();
  store?.memory.clear();
  connectSnapshot = null;
  resetAllZohoProductCaches();
}
