/**
 * Portal marketplace tenant-scope contract.
 * Aligns with Hub ECO-002 states. Portal is a tenant/client context:
 * UNMAPPED and AUTHORITY_UNAVAILABLE fail closed (empty allow-list).
 * AUTHORIZED_GLOBAL is never inferred from null/missing mapping.
 */
export const MARKETPLACE_SCOPE_STATES = [
  "SCOPED",
  "AUTHORIZED_GLOBAL",
  "UNMAPPED",
  "AUTHORITY_UNAVAILABLE",
] as const;

export type MarketplaceScopeState = (typeof MARKETPLACE_SCOPE_STATES)[number];

export type HubCatalogAuthority =
  | "not_attempted"
  | "resolved"
  | "unavailable"
  | "error";

export type MarketplaceScopeInput = {
  /** Portal tenant binding from the live authenticated user. */
  clientId?: string | null;
  /**
   * Affirmative global authorization only. Never set from missing mapping.
   * Portal clients must not receive this by default.
   */
  authorizedGlobal?: boolean;
  /** Hub catalog lookup outcome. Defaults to not_attempted. */
  hubCatalog?: HubCatalogAuthority;
};

export type MarketplaceScopeResult = {
  status: MarketplaceScopeState;
  /** Tenant allow-list. null only with AUTHORIZED_GLOBAL. [] = fail-closed. */
  trustedClientIds: string[] | null;
  items: unknown[];
  failClosed: boolean;
  reason: string;
};

function normalizeClientId(clientId: string | null | undefined): string | null {
  if (typeof clientId !== "string") return null;
  const trimmed = clientId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve marketplace scope for an authenticated portal principal.
 * Does not invent catalog rows. Does not treat UNMAPPED as unrestricted.
 */
export function resolvePortalMarketplaceScope(
  input: MarketplaceScopeInput,
): MarketplaceScopeResult {
  const clientId = normalizeClientId(input.clientId);
  const hubCatalog = input.hubCatalog ?? "not_attempted";

  if (input.authorizedGlobal === true) {
    return {
      status: "AUTHORIZED_GLOBAL",
      trustedClientIds: null,
      items: [],
      failClosed: false,
      reason: "Explicit global marketplace authorization is active.",
    };
  }

  if (hubCatalog === "error") {
    return {
      status: "AUTHORITY_UNAVAILABLE",
      trustedClientIds: clientId ? [clientId] : [],
      items: [],
      failClosed: true,
      reason: "Marketplace authority could not be verified. Access is denied until lookup succeeds.",
    };
  }

  if (!clientId) {
    return {
      status: "UNMAPPED",
      trustedClientIds: [],
      items: [],
      failClosed: true,
      reason: "This account is not mapped to a client tenant.",
    };
  }

  if (hubCatalog === "unavailable" || hubCatalog === "not_attempted") {
    return {
      status: "AUTHORITY_UNAVAILABLE",
      trustedClientIds: [clientId],
      items: [],
      failClosed: true,
      reason: "Tenant catalog is not available from Hub yet.",
    };
  }

  // hubCatalog === "resolved" — still return empty items until a real catalog lands.
  return {
    status: "SCOPED",
    trustedClientIds: [clientId],
    items: [],
    failClosed: false,
    reason: "Tenant marketplace scope is active.",
  };
}
