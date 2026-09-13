/**
 * Client-side view of the marketplace tenant-scope result (C4, 2026-09-13).
 *
 * The authoritative four-state enum is produced by the Hub and surfaced by the
 * website's `/api/portal/marketplace` contract (Cursor lane). This module is the
 * only place the UI interprets it, so when the server field lands, the wiring
 * is `parseTenantScopeState(payload)` and nothing else.
 *
 * Fail-closed rules (ECO-002):
 *  - an unknown, missing or malformed state is AUTHORITY_UNAVAILABLE, never SCOPED
 *  - UNMAPPED is never presented as authorized or unrestricted
 *  - only SCOPED and AUTHORIZED_GLOBAL may render a catalog at all
 */
export const TENANT_SCOPE_STATES = [
  "SCOPED",
  "AUTHORIZED_GLOBAL",
  "UNMAPPED",
  "AUTHORITY_UNAVAILABLE",
] as const;

export type TenantScopeState = (typeof TENANT_SCOPE_STATES)[number];

export const FAIL_CLOSED_STATE: TenantScopeState = "AUTHORITY_UNAVAILABLE";

/** Field names the contract may use; the first present, valid one wins. */
const STATE_FIELDS = ["tenantState", "tenantScopeState", "scopeState"] as const;

/**
 * Pre-contract bridge: the current route only sends `status: "unavailable" | "unmapped"`.
 * Both map to restricted states, so nothing here can widen access.
 */
const LEGACY_STATUS: Record<string, TenantScopeState> = {
  unmapped: "UNMAPPED",
  unavailable: "AUTHORITY_UNAVAILABLE",
};

export function isTenantScopeState(value: unknown): value is TenantScopeState {
  return typeof value === "string" && (TENANT_SCOPE_STATES as readonly string[]).includes(value);
}

export function parseTenantScopeState(payload: unknown): TenantScopeState {
  if (!payload || typeof payload !== "object") return FAIL_CLOSED_STATE;
  const record = payload as Record<string, unknown>;
  for (const field of STATE_FIELDS) {
    const raw = record[field];
    const candidate = typeof raw === "string" ? raw.trim().toUpperCase() : raw;
    if (isTenantScopeState(candidate)) return candidate;
    if (raw !== undefined) return FAIL_CLOSED_STATE; // present but not a known state
  }
  const legacy = record.status;
  if (typeof legacy === "string" && legacy in LEGACY_STATUS) return LEGACY_STATUS[legacy];
  return FAIL_CLOSED_STATE;
}

/** Whether this state permits rendering catalog items the server sent. */
export function canRenderCatalog(state: TenantScopeState): boolean {
  return state === "SCOPED" || state === "AUTHORIZED_GLOBAL";
}

export type TenantScopePresentation = {
  /** Short badge text — client-facing, not the enum. */
  badge: string;
  tone: "ok" | "info" | "restricted" | "unavailable";
  title: string;
  body: string;
  /** Primary action the client can take from this state. */
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export const TENANT_SCOPE_PRESENTATION: Record<TenantScopeState, TenantScopePresentation> = {
  SCOPED: {
    badge: "Your organization's catalog",
    tone: "ok",
    title: "Items approved for your organization",
    body:
      "This catalog is scoped to your tenant. Anything you request here goes through DE approval before it is ordered; nothing is charged from this page.",
    primary: { label: "Request approval", href: "/portal/forms" },
    secondary: { label: "Open procurement", href: "/portal/procurement" },
  },
  AUTHORIZED_GLOBAL: {
    badge: "DE standard catalog",
    tone: "info",
    title: "Standard catalog, DE-managed",
    body:
      "Your account is authorized for the DE standard catalog rather than a tenant-specific one. Requests still go through DE approval before anything is ordered.",
    primary: { label: "Request approval", href: "/portal/forms" },
    secondary: { label: "Open procurement", href: "/portal/procurement" },
  },
  UNMAPPED: {
    badge: "Account not linked to a tenant",
    tone: "restricted",
    title: "Marketplace is restricted until your account is linked",
    body:
      "This login is not mapped to a client organization yet, so no catalog can be shown. DE has to link the account before items appear; you can still submit a ticket to request it.",
    primary: { label: "Ask DE to link this account", href: "/portal/tickets/new" },
    secondary: { label: "View company profile", href: "/portal/company" },
  },
  AUTHORITY_UNAVAILABLE: {
    badge: "Temporarily unavailable",
    tone: "unavailable",
    title: "Catalog authority is not reachable right now",
    body:
      "DE could not confirm what your organization is entitled to, so the catalog is held back rather than guessed. Try again shortly, or request approval and DE will confirm scope by hand.",
    primary: { label: "Request approval", href: "/portal/forms" },
    secondary: { label: "Contact support", href: "/portal/tickets/new" },
  },
};
