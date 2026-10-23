/**
 * DE portal access model — shared by client and server (lane A, Wave 1).
 *
 * Registry layout (see docs/lanes/registry.md):
 *   types.ts    — this file: model + evaluator (lane A owns)
 *   lane-*.ts   — one permission file per lane (lane A owns lane-a.ts)
 *   index.ts    — merges the lane files and exports can()
 *
 * Rule semantics (AccessRule):
 *   superAdminOnly  — break-glass (`role === "admin"`) only. Never widened.
 *   deOnly          — DE staff + break-glass only (hidden from client roles).
 *   sample          — page shows sample content; only the break-glass account sees it
 *                     (lane-a-update-3.md §3).
 *   featureReady    — false while the feature behind the item is unfinished; hidden from
 *                     DE staff and client roles, visible to break-glass (lane-a-update-3.md §3).
 *   roles           — which client hats hold it. `[]` = no client hat. Undefined = every hat.
 *   entitlement     — the company must hold this entitlement (clients only; DE classes bypass).
 *   requiresData    — nav only: hide until the named datum exists (honest empty menu).
 *   scoped          — tenant scope: a client principal may only act inside its own company
 *                     (default true when a companyId is passed to can()).
 *
 * Unknown permission = deny for everyone except the break-glass account, whose access is
 * never reduced from today's Administrator (plan DO NOT CHANGE; update 2 §2).
 */

export type AccountClass = "super_admin" | "de_staff" | "client";

export const CLIENT_ROLES = [
  "standard",
  "approver",
  "client_admin",
  "billing",
  "purchaser",
  "owner",
] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];

export const ENTITLEMENT_KEYS = ["cloud_edge", "voice", "security_awareness"] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

/** Datum names a nav item may require before it appears. */
export type NavDataKey = "sharedFiles" | "itPlan";

/** The principal fields the evaluator needs (req.user / PortalUserSession shape). */
export type AccessPrincipal = {
  role?: string | null;
  orgRole?: string | null;
  isCompanyItContact?: boolean;
  clientId?: string | null;
  /** Explicitly granted client hats (portal_users.client_roles). */
  clientRoles?: ClientRole[] | null;
};

export type AccessRule = {
  superAdminOnly?: boolean;
  deOnly?: boolean;
  sample?: boolean;
  featureReady?: boolean;
  roles?: ClientRole[];
  entitlement?: EntitlementKey;
  requiresData?: NavDataKey;
  scoped?: boolean;
};

export type AccessContext = {
  principal: AccessPrincipal | null | undefined;
  /** Company the action targets. Client principals must match their own company. */
  companyId?: string | null;
  /** Entitlements held by the target company (clients only; DE classes bypass). */
  entitlements?: EntitlementKey[] | null;
  /** Nav data flags for the active company. */
  data?: Partial<Record<NavDataKey, boolean>> | null;
};

/** Break-glass = today's `admin` value. Never renamed, never demoted (update 2 §2). */
export function accountClassOf(principal: AccessPrincipal | null | undefined): AccountClass {
  if (principal?.role === "admin") return "super_admin";
  if (principal?.role === "staff") return "de_staff";
  return "client";
}

export function isSuperAdmin(principal: AccessPrincipal | null | undefined): boolean {
  return accountClassOf(principal) === "super_admin";
}

export function isDeStaff(principal: AccessPrincipal | null | undefined): boolean {
  const cls = accountClassOf(principal);
  return cls === "de_staff" || cls === "super_admin";
}

/**
 * Effective client hats: explicit rows plus the legacy org-role derivation, so no
 * account loses access it has today. Explicit rows only ever add a hat.
 */
export function effectiveClientRoles(principal: AccessPrincipal | null | undefined): ClientRole[] {
  const roles = new Set<ClientRole>();
  for (const r of principal?.clientRoles ?? []) {
    if ((CLIENT_ROLES as readonly string[]).includes(r)) roles.add(r);
  }
  const org = principal?.orgRole;
  if (
    principal?.isCompanyItContact ||
    org === "company_it_contact" ||
    org === "dept_it_contact"
  ) {
    for (const r of CLIENT_ROLES) roles.add(r);
  } else if (org === "manager") {
    roles.add("approver");
  }
  // Every client user is at least `standard` — it is the base hat.
  roles.add("standard");
  return [...roles];
}

function tenantOk(rule: AccessRule, ctx: AccessContext, cls: AccountClass): boolean {
  if (rule.scoped === false) return true;
  if (cls !== "client") return true; // DE staff and break-glass manage every company
  if (ctx.companyId == null || ctx.companyId === "") return true; // route scopes its own query
  return ctx.principal?.clientId === ctx.companyId;
}

/** The single rule evaluator used by can() and by the nav registry. */
export function ruleAllows(rule: AccessRule | undefined, ctx: AccessContext): boolean {
  const cls = accountClassOf(ctx.principal);
  if (cls === "super_admin") return true; // today's Administrator access, unchanged
  if (!rule) return false; // unknown permission: fail closed
  if (rule.superAdminOnly) return false;
  if (cls === "de_staff") {
    // DE staff are client managers, but there are no samples in the product
    // (lane-a-update-3.md §3): only the break-glass account still sees them.
    if (rule.sample || rule.featureReady === false) return false;
    return tenantOk(rule, ctx, cls);
  }
  if (rule.deOnly || rule.sample || rule.featureReady === false) return false;
  if (rule.requiresData && !ctx.data?.[rule.requiresData]) return false;
  if (rule.entitlement && !(ctx.entitlements ?? []).includes(rule.entitlement)) return false;
  if (rule.roles) {
    const hats = effectiveClientRoles(ctx.principal);
    if (!rule.roles.some((r) => hats.includes(r))) return false;
  }
  return tenantOk(rule, ctx, cls);
}
